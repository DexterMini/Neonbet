"""
================================================================================
MONTE CARLO BANKROLL STRESS TEST - ULTRA-FAST VECTORIZED VERSION
================================================================================
Author: Senior Quant Developer & Actuary
Purpose: Black Swan Event Stress Testing - Optimized for Speed

Uses pure numpy vectorization for maximum performance.
No Python loops over rounds - all calculations are array operations.
================================================================================
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Tuple, List
from dataclasses import dataclass
import time

plt.style.use('seaborn-v0_8-darkgrid')


@dataclass
class SimConfig:
    bet_size: float = 10.0
    house_edge: float = 0.02
    max_win: float = 1_000_000
    num_rounds: int = 10_000_000
    num_walks: int = 1_000
    initial_capitals: List[float] = None
    seed: int = 42
    
    def __post_init__(self):
        if self.initial_capitals is None:
            self.initial_capitals = [500_000, 1_500_000, 5_000_000]


class FastMonteCarlo:
    """
    Ultra-fast Monte Carlo using vectorized numpy operations.
    
    Key insight: We don't need to simulate every single round.
    We only care about:
    1. Number of jackpots that occur
    2. When they occur relative to accumulated profit
    
    The bankroll path can be computed as:
    B(t) = B0 + t * profit_per_round - sum(jackpot_losses before t)
    
    Ruin occurs if B(t) <= 0 for any t where a jackpot occurred.
    """
    
    def __init__(self, config: SimConfig):
        self.config = config
        np.random.seed(config.seed)
        
        # Jackpot probability: ~1 in 10M for realistic stress test
        self.p_jackpot = 1e-7
        
        # House profit per round (from regular play)
        # With 2% house edge and jackpot contributing ~1% to RTP
        self.profit_per_round = config.bet_size * 0.03  # 3% effective edge from regular
        
        # Net loss when jackpot hits
        self.jackpot_net_loss = config.max_win - config.bet_size
        
        print("=" * 70)
        print("ULTRA-FAST MONTE CARLO STRESS TEST")
        print("=" * 70)
        print(f"Bet Size:              ${config.bet_size}")
        print(f"House Edge:            {config.house_edge * 100}%")
        print(f"Max Win:               ${config.max_win:,}")
        print(f"Rounds/simulation:     {config.num_rounds:,}")
        print(f"Number of walks:       {config.num_walks:,}")
        print(f"Jackpot probability:   {self.p_jackpot:.2e}")
        print(f"Expected jackpots:     {self.p_jackpot * config.num_rounds:.2f}")
        print("=" * 70)
    
    def simulate_fast(self, B0: float) -> Tuple[float, dict]:
        """
        Vectorized simulation for all walks at once.
        
        Instead of simulating every round, we:
        1. Generate number of jackpots per walk (Poisson)
        2. For each walk, check if accumulated profit before each jackpot 
           was enough to survive
        """
        N = self.config.num_rounds
        walks = self.config.num_walks
        
        print(f"\nSimulating B₀ = ${B0:,}...")
        start = time.time()
        
        # Total profit without any jackpots
        total_profit_no_jackpot = N * self.profit_per_round
        
        # Generate jackpot counts for all walks (Poisson distribution)
        jackpot_counts = np.random.poisson(self.p_jackpot * N, size=walks)
        
        # For walks with jackpots, determine if ruin occurred
        ruined = np.zeros(walks, dtype=bool)
        final_capitals = np.zeros(walks)
        min_capitals = np.zeros(walks)
        
        for w in range(walks):
            num_jp = jackpot_counts[w]
            
            if num_jp == 0:
                # No jackpots - just accumulate profit
                final_capitals[w] = B0 + total_profit_no_jackpot
                min_capitals[w] = B0  # Capital only grows
            else:
                # Generate jackpot positions (when they occur)
                jp_positions = np.sort(np.random.uniform(0, N, size=num_jp))
                
                # Calculate capital at each jackpot moment
                capital = B0
                min_cap = B0
                
                for i, pos in enumerate(jp_positions):
                    # Profit accumulated before this jackpot
                    if i == 0:
                        profit_before = pos * self.profit_per_round
                    else:
                        profit_before = (pos - jp_positions[i-1]) * self.profit_per_round
                    
                    capital += profit_before
                    capital -= self.jackpot_net_loss  # Pay out jackpot
                    
                    if capital < min_cap:
                        min_cap = capital
                    
                    if capital <= 0:
                        ruined[w] = True
                        break
                
                # If survived all jackpots, add remaining profit
                if not ruined[w]:
                    remaining_rounds = N - jp_positions[-1]
                    capital += remaining_rounds * self.profit_per_round
                
                final_capitals[w] = capital
                min_capitals[w] = min_cap
        
        elapsed = time.time() - start
        
        ror = ruined.mean()
        
        stats = {
            'risk_of_ruin': ror,
            'ruined_count': ruined.sum(),
            'mean_final': final_capitals.mean(),
            'std_final': final_capitals.std(),
            'median_final': np.median(final_capitals),
            'min_observed': min_capitals.min(),
            'max_drawdown': (B0 - min_capitals).max(),
            'total_jackpots': jackpot_counts.sum(),
            'mean_jackpots': jackpot_counts.mean(),
            'time': elapsed,
            'VaR_99.9': np.percentile(final_capitals, 0.1),
        }
        
        tail = final_capitals[final_capitals <= stats['VaR_99.9']]
        stats['CVaR_99.9'] = tail.mean() if len(tail) > 0 else stats['VaR_99.9']
        
        print(f"  Done in {elapsed:.2f}s | RoR: {ror*100:.2f}% | Jackpots: {jackpot_counts.sum()}")
        
        return ror, stats, final_capitals, min_capitals
    
    def run_scenarios(self) -> Dict:
        """Run all capital scenarios"""
        results = {}
        
        print("\n" + "=" * 70)
        print("RUNNING CAPITAL SCENARIOS")
        print("=" * 70)
        
        for B0 in self.config.initial_capitals:
            ror, stats, finals, mins = self.simulate_fast(B0)
            results[B0] = {'ror': ror, 'stats': stats, 'finals': finals, 'mins': mins}
        
        return results
    
    def find_safe_capital(self, target_ror: float = 0.001) -> Tuple[float, float]:
        """Find minimum capital for target RoR"""
        print("\n" + "=" * 70)
        print(f"SEARCHING FOR SAFE CAPITAL (RoR < {target_ror*100:.2f}%)")
        print("=" * 70)
        
        low = self.config.max_win
        high = self.config.max_win * 5
        best = high
        
        for i in range(8):
            mid = (low + high) / 2
            ror, _, _, _ = self.simulate_fast(mid)
            
            print(f"  [{i+1}] ${mid:,.0f} -> RoR = {ror*100:.3f}%")
            
            if ror <= target_ror:
                best = mid
                high = mid
            else:
                low = mid
        
        # Verify
        print(f"\nVerifying ${best:,.0f}...")
        final_ror, _, _, _ = self.simulate_fast(best)
        
        return best, final_ror
    
    def plot_results(self, results: Dict, save_path: str = None):
        """Generate visualizations"""
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        colors = ['#e74c3c', '#f39c12', '#27ae60']
        
        # Plot 1: Final capital distributions
        ax1 = axes[0, 0]
        for idx, (B0, data) in enumerate(results.items()):
            ax1.hist(data['finals'], bins=50, alpha=0.6, color=colors[idx],
                    label=f'B0=${B0/1e6:.1f}M', edgecolor='black', linewidth=0.5)
        ax1.axvline(x=0, color='red', linestyle='--', linewidth=2, label='Ruin')
        ax1.set_xlabel('Final Capital ($)')
        ax1.set_ylabel('Frequency')
        ax1.set_title('Final Capital Distribution', fontweight='bold')
        ax1.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'${x/1e6:.0f}M'))
        ax1.legend()
        
        # Plot 2: Risk of Ruin bar chart
        ax2 = axes[0, 1]
        capitals = list(results.keys())
        rors = [results[B0]['ror'] * 100 for B0 in capitals]
        bars = ax2.bar([f'${B0/1e6:.1f}M' for B0 in capitals], rors, color=colors)
        
        for bar, ror in zip(bars, rors):
            ax2.annotate(f'{ror:.2f}%', 
                        xy=(bar.get_x() + bar.get_width()/2, bar.get_height()),
                        xytext=(0, 5), textcoords="offset points",
                        ha='center', fontsize=12, fontweight='bold')
        
        ax2.axhline(y=0.1, color='green', linestyle='--', linewidth=2, label='Target: 0.1%')
        ax2.set_ylabel('Risk of Ruin (%)')
        ax2.set_title('RISK OF RUIN BY CAPITAL', fontweight='bold')
        ax2.legend()
        
        # Plot 3: Minimum capital distribution (drawdown indicator)
        ax3 = axes[1, 0]
        for idx, (B0, data) in enumerate(results.items()):
            drawdowns = B0 - data['mins']
            ax3.hist(drawdowns[drawdowns > 0], bins=30, alpha=0.6, color=colors[idx],
                    label=f'B0=${B0/1e6:.1f}M', edgecolor='black', linewidth=0.5)
        ax3.set_xlabel('Maximum Drawdown ($)')
        ax3.set_ylabel('Frequency')
        ax3.set_title('Maximum Drawdown Distribution', fontweight='bold')
        ax3.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'${x/1e6:.1f}M'))
        ax3.legend()
        
        # Plot 4: Summary table
        ax4 = axes[1, 1]
        ax4.axis('off')
        
        summary = "============================================\n"
        summary += "     STRESS TEST RESULTS SUMMARY          \n"
        summary += "============================================\n"
        
        for B0, data in results.items():
            s = data['stats']
            summary += f"B0 = ${B0:,.0f}\n"
            summary += f"  Risk of Ruin:  {data['ror']*100:>8.2f}%\n"
            summary += f"  Mean Final:    ${s['mean_final']:>12,.0f}\n"
            summary += f"  Max Drawdown:  ${s['max_drawdown']:>12,.0f}\n"
            summary += f"  CVaR (99.9%):  ${s['CVaR_99.9']:>12,.0f}\n"
            summary += "--------------------------------------------\n"
        
        summary += "============================================"
        
        ax4.text(0.1, 0.9, summary, transform=ax4.transAxes, fontsize=10,
                verticalalignment='top', fontfamily='monospace',
                bbox=dict(facecolor='lightgray', alpha=0.5))
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight', facecolor='white')
            print(f"\n📊 Plot saved: {save_path}")
        
        # Don't block on show - just save
        plt.close()
    
    def generate_report(self, results: Dict, safe_capital: float = None) -> str:
        """Generate executive report"""
        lines = [
            "",
            "═" * 80,
            "       MONTE CARLO STRESS TEST - EXECUTIVE REPORT",
            "═" * 80,
            "",
            "CONFIGURATION:",
            f"  • Bet Size:           ${self.config.bet_size}",
            f"  • House Edge:         {self.config.house_edge * 100}%",
            f"  • Max Win (Jackpot):  ${self.config.max_win:,}",
            f"  • Simulated Rounds:   {self.config.num_rounds:,}",
            f"  • Simulation Walks:   {self.config.num_walks:,}",
            f"  • Jackpot Prob:       {self.p_jackpot:.2e}",
            "",
            "─" * 80,
            "RESULTS BY INITIAL CAPITAL:",
            "─" * 80,
        ]
        
        for B0, data in results.items():
            s = data['stats']
            lines.extend([
                "",
                f"  💰 B₀ = ${B0:,}",
                f"     ├─ Risk of Ruin:      {data['ror']*100:>8.3f}%",
                f"     ├─ Ruined Count:      {s['ruined_count']:>8} / {self.config.num_walks}",
                f"     ├─ Mean Final:        ${s['mean_final']:>15,.0f}",
                f"     ├─ Std Dev:           ${s['std_final']:>15,.0f}",
                f"     ├─ Max Drawdown:      ${s['max_drawdown']:>15,.0f}",
                f"     ├─ VaR (99.9%):       ${s['VaR_99.9']:>15,.0f}",
                f"     └─ CVaR (99.9%):      ${s['CVaR_99.9']:>15,.0f}",
            ])
        
        lines.extend([
            "",
            "═" * 80,
            "CONCLUSIONS & RECOMMENDATIONS",
            "═" * 80,
            "",
        ])
        
        if safe_capital:
            lines.append(f"✅ SAFE CAPITAL (RoR < 0.1%): ${safe_capital:,.0f}")
        
        # Calculate recommendations
        worst_cvar = min(d['stats']['CVaR_99.9'] for d in results.values())
        rec = max(self.config.max_win * 3, abs(worst_cvar) * 3 if worst_cvar < 0 else self.config.max_win * 5)
        
        lines.extend([
            "",
            "💼 CAPITAL RECOMMENDATIONS:",
            f"   • Minimum (2x Max Win):     ${self.config.max_win * 2:,}",
            f"   • Recommended (3x CVaR):    ${rec:,.0f}",
            f"   • Conservative (5x Max):    ${self.config.max_win * 5:,}",
            "",
            "⚠️  KEY INSIGHTS:",
            "   1. A single jackpot can eliminate months of accumulated profit",
            "   2. Risk compounds exponentially with multiple early jackpots",
            "   3. Undercapitalization guarantees eventual platform failure",
            "   4. Capital buffers must scale with max payout, not average bet",
            "",
            "═" * 80,
        ])
        
        return "\n".join(lines)


def main():
    print("\n" + "🎰" * 25)
    print("  CRYPTO iGAMING PLATFORM - BANKROLL STRESS TEST")
    print("🎰" * 25)
    
    config = SimConfig(
        bet_size=10.0,
        house_edge=0.02,
        max_win=1_000_000,
        num_rounds=10_000_000,
        num_walks=1_000,
        initial_capitals=[500_000, 1_500_000, 5_000_000],
        seed=42
    )
    
    sim = FastMonteCarlo(config)
    
    # Run scenarios
    results = sim.run_scenarios()
    
    # Find safe capital
    safe_capital, safe_ror = sim.find_safe_capital(target_ror=0.001)
    print(f"\n🎯 SAFE CAPITAL FOUND: ${safe_capital:,.0f} (RoR = {safe_ror*100:.3f}%)")
    
    # Generate plots
    print("\n📊 Generating visualizations...")
    sim.plot_results(results, save_path='stress_test_results.png')
    
    # Generate and save report
    report = sim.generate_report(results, safe_capital)
    print(report)
    
    with open('stress_test_report.txt', 'w', encoding='utf-8') as f:
        f.write(report)
    print("\n📄 Report saved: stress_test_report.txt")
    
    return results, safe_capital


if __name__ == "__main__":
    results, safe_capital = main()
