"""
================================================================================
MONTE CARLO BANKROLL STRESS TEST - REALISTIC RTP MODEL
================================================================================
Author: Senior Quant Developer & Actuary
Purpose: Black Swan Event Stress Testing with Correct Mathematical Model

MATHEMATICAL FRAMEWORK:
-----------------------
For a slot with RTP = 98% and Max Win = $1,000,000 on a $10 bet:

The expected return must equal: E[Return] = RTP × bet = $9.80

Let's model this as a mixture distribution:
- Probability p_jackpot: Win $1,000,000
- Probability p_small: Win smaller amounts (normal play)
- Probability p_lose: Lose bet

For proper RTP with extreme max win:
p_jackpot ≈ (bet × HE_contribution) / max_win

For realistic modeling:
- Average 1 max win per 10 million bets gives p = 1e-7
- This maintains RTP while allowing for extreme events
================================================================================
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Tuple, List
import warnings
from dataclasses import dataclass
import time

warnings.filterwarnings('ignore')
plt.style.use('seaborn-v0_8-darkgrid')


@dataclass  
class SimulationConfig:
    bet_size: float = 10.0
    house_edge: float = 0.02
    rtp: float = 0.98
    max_win: float = 1_000_000
    num_rounds: int = 10_000_000
    num_walks: int = 1_000
    initial_capitals: List[float] = None
    seed: int = 42
    sample_rate: int = 100000
    
    def __post_init__(self):
        if self.initial_capitals is None:
            self.initial_capitals = [500_000, 1_500_000, 5_000_000]


class RealisticMonteCarlo:
    """
    Realistic Monte Carlo simulation with proper RTP calibration.
    
    Key insight: For the house to maintain 2% edge with a $1M max payout,
    jackpots must be EXTREMELY rare. We model this correctly.
    """
    
    def __init__(self, config: SimulationConfig):
        self.config = config
        np.random.seed(config.seed)
        
        # CRITICAL: Calculate CORRECT jackpot probability for RTP maintenance
        # 
        # House edge = 2% means: Expected house profit per bet = $0.20
        # 
        # Model: Player loses $10 with prob (1-p), wins $1M with prob p
        # E[House Profit] = (1-p) × $10 - p × ($1M - $10)
        #                 = $10 - $10p - $1Mp + $10p
        #                 = $10 - $1Mp
        # 
        # For E[House Profit] = $0.20:
        # $10 - $1Mp = $0.20
        # p = $9.80 / $1M = 9.8e-6
        #
        # BUT this assumes player ONLY wins on jackpot (too volatile)
        
        # REALISTIC MODEL:
        # Blend of regular small payouts + rare jackpot
        # Jackpot contributes ~10% of RTP, rest from regular wins
        
        self.p_jackpot = 1e-7  # 1 in 10 million (very rare)
        self.jackpot_rtp_contribution = self.p_jackpot * config.max_win / config.bet_size
        
        # Regular play makes up the rest
        self.regular_rtp = config.rtp - self.jackpot_rtp_contribution
        
        print("=" * 70)
        print("MONTE CARLO STRESS TEST - REALISTIC RTP MODEL")
        print("=" * 70)
        print(f"Bet Size:               ${config.bet_size:,.2f}")
        print(f"House Edge:             {config.house_edge * 100:.2f}%")
        print(f"Max Win:                ${config.max_win:,.0f}")
        print(f"Rounds per simulation:  {config.num_rounds:,}")
        print(f"Number of walks:        {config.num_walks:,}")
        print("-" * 70)
        print(f"Jackpot probability:    {self.p_jackpot:.2e} (1 in {int(1/self.p_jackpot):,})")
        print(f"Expected jackpots/sim:  {self.p_jackpot * config.num_rounds:.2f}")
        print(f"Jackpot RTP contrib:    {self.jackpot_rtp_contribution * 100:.4f}%")
        print(f"Regular play RTP:       {self.regular_rtp * 100:.4f}%")
        print("=" * 70)
    
    def simulate_walk(self, B0: float, store_path: bool = False) -> dict:
        """Simulate a single walk with realistic model"""
        config = self.config
        N = config.num_rounds
        
        # House expected profit per round from regular play
        # Regular RTP means player gets back regular_rtp of bet
        # House keeps (1 - regular_rtp) = house_edge + jackpot_contrib
        effective_house_edge = 1 - self.regular_rtp
        profit_per_round = config.bet_size * effective_house_edge
        
        # But when jackpot hits, house loses big
        jackpot_loss = config.max_win - config.bet_size
        
        # Generate jackpot count for this walk
        num_jackpots = np.random.poisson(self.p_jackpot * N)
        
        if num_jackpots > 0:
            jackpot_positions = np.sort(np.random.choice(N, size=min(num_jackpots, N), replace=False))
        else:
            jackpot_positions = np.array([], dtype=int)
        
        # Track metrics
        current_capital = B0
        min_capital = B0
        peak = B0
        max_drawdown = 0
        ruined = False
        ruin_round = N
        
        sampled_path = [] if store_path else None
        sample_rate = config.sample_rate
        jackpot_idx = 0
        
        for round_num in range(N):
            # Regular profit
            current_capital += profit_per_round
            
            # Check for jackpot
            if jackpot_idx < len(jackpot_positions) and jackpot_positions[jackpot_idx] == round_num:
                current_capital -= jackpot_loss
                jackpot_idx += 1
            
            # Update tracking
            if current_capital > peak:
                peak = current_capital
            
            drawdown = peak - current_capital
            if drawdown > max_drawdown:
                max_drawdown = drawdown
            
            if current_capital < min_capital:
                min_capital = current_capital
            
            if current_capital <= 0 and not ruined:
                ruined = True
                ruin_round = round_num
                if not store_path:
                    break
            
            if store_path and (round_num % sample_rate == 0 or round_num == N - 1):
                sampled_path.append((round_num, current_capital))
        
        return {
            'final_capital': current_capital,
            'min_capital': min_capital,
            'ruined': ruined,
            'ruin_round': ruin_round,
            'max_drawdown': max_drawdown,
            'num_jackpots': num_jackpots,
            'sampled_path': sampled_path
        }
    
    def simulate_bankroll(self, B0: float, num_paths_to_store: int = 50) -> Tuple[list, float, dict]:
        """Run all walks for a given initial capital"""
        config = self.config
        walks = config.num_walks
        
        print(f"\nSimulating B₀ = ${B0:,}...")
        start_time = time.time()
        
        final_capitals = []
        ruined_count = 0
        ruin_rounds = []
        min_capitals = []
        max_drawdowns = []
        total_jackpots = 0
        stored_paths = []
        
        for w in range(walks):
            store_path = w < num_paths_to_store
            result = self.simulate_walk(B0, store_path=store_path)
            
            final_capitals.append(result['final_capital'])
            min_capitals.append(result['min_capital'])
            max_drawdowns.append(result['max_drawdown'])
            total_jackpots += result['num_jackpots']
            
            if result['ruined']:
                ruined_count += 1
                ruin_rounds.append(result['ruin_round'])
            
            if store_path:
                stored_paths.append(result['sampled_path'])
            
            if (w + 1) % 100 == 0:
                print(f"  Progress: {w + 1}/{walks}", end='\r')
        
        elapsed = time.time() - start_time
        
        final_capitals = np.array(final_capitals)
        risk_of_ruin = ruined_count / walks
        
        var_99_9 = np.percentile(final_capitals, 0.1)
        tail = final_capitals[final_capitals <= var_99_9]
        cvar_99_9 = tail.mean() if len(tail) > 0 else var_99_9
        
        stats = {
            'risk_of_ruin': risk_of_ruin,
            'mean_final_capital': final_capitals.mean(),
            'std_final_capital': final_capitals.std(),
            'median_final_capital': np.median(final_capitals),
            'min_capital_observed': np.array(min_capitals).min(),
            'max_drawdown_worst': np.array(max_drawdowns).max(),
            'ruined_count': ruined_count,
            'earliest_ruin': min(ruin_rounds) if ruin_rounds else config.num_rounds,
            'mean_ruin_round': np.mean(ruin_rounds) if ruin_rounds else config.num_rounds,
            'simulation_time': elapsed,
            'total_jackpots': total_jackpots,
            'VaR_99.9': var_99_9,
            'CVaR_99.9': cvar_99_9,
        }
        
        print(f"  Completed in {elapsed:.1f}s | RoR: {risk_of_ruin*100:.2f}% | Jackpots: {total_jackpots}")
        
        return stored_paths, risk_of_ruin, stats
    
    def run_all_scenarios(self) -> Dict[float, Tuple[list, float, dict]]:
        """Run simulations for all capital scenarios"""
        results = {}
        
        print("\n" + "=" * 70)
        print("RUNNING ALL CAPITAL SCENARIOS")
        print("=" * 70)
        
        for B0 in self.config.initial_capitals:
            paths, ror, stats = self.simulate_bankroll(B0)
            results[B0] = (paths, ror, stats)
        
        return results
    
    def find_safe_capital(self, target_ror: float = 0.001) -> Tuple[float, float]:
        """Binary search for safe capital"""
        print("\n" + "=" * 70)
        print(f"FINDING SAFE CAPITAL (RoR < {target_ror*100:.2f}%)")
        print("=" * 70)
        
        # Start from max_win as minimum safe capital
        low = self.config.max_win
        high = self.config.max_win * 10
        best_safe = high
        
        original_walks = self.config.num_walks
        self.config.num_walks = 500
        
        for iteration in range(8):
            mid = (low + high) / 2
            _, ror, _ = self.simulate_bankroll(mid, num_paths_to_store=0)
            
            print(f"  Iteration {iteration+1}: ${mid:,.0f} -> RoR={ror*100:.3f}%")
            
            if ror <= target_ror:
                best_safe = mid
                high = mid
            else:
                low = mid
        
        self.config.num_walks = original_walks
        
        # Verify
        print(f"\nVerifying: ${best_safe:,.0f}")
        _, final_ror, _ = self.simulate_bankroll(best_safe, num_paths_to_store=0)
        
        return best_safe, final_ror
    
    def plot_results(self, results: Dict, save_path: str = None):
        """Generate visualizations"""
        fig = plt.figure(figsize=(16, 12))
        colors = ['#e74c3c', '#f39c12', '#27ae60']
        
        # Plot 1: Capital evolution
        ax1 = fig.add_subplot(2, 2, 1)
        for idx, (B0, (paths, ror, stats)) in enumerate(results.items()):
            for path in paths[:15]:
                if path:
                    rounds, capitals = zip(*path)
                    ax1.plot(rounds, capitals, alpha=0.4, color=colors[idx], linewidth=0.8)
        
        ax1.axhline(y=0, color='black', linestyle='--', linewidth=2)
        ax1.set_xlabel('Round Number')
        ax1.set_ylabel('Bankroll ($)')
        ax1.set_title('Bankroll Evolution Over 10M Rounds', fontweight='bold')
        ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'${x/1e6:.1f}M'))
        
        for idx, B0 in enumerate(results.keys()):
            ax1.plot([], [], color=colors[idx], linewidth=2, 
                    label=f'B₀=${B0/1e6:.1f}M (RoR={results[B0][1]*100:.1f}%)')
        ax1.legend()
        
        # Plot 2: RoR comparison
        ax2 = fig.add_subplot(2, 2, 2)
        capitals = list(results.keys())
        rors = [results[B0][1] * 100 for B0 in capitals]
        
        bars = ax2.bar([f'${B0/1e6:.1f}M' for B0 in capitals], rors, color=colors)
        for bar, ror in zip(bars, rors):
            ax2.annotate(f'{ror:.2f}%', xy=(bar.get_x() + bar.get_width()/2, bar.get_height()),
                        xytext=(0, 3), textcoords="offset points", ha='center', fontweight='bold')
        
        ax2.axhline(y=0.1, color='green', linestyle='--', label='Target: 0.1%')
        ax2.set_ylabel('Risk of Ruin (%)')
        ax2.set_title('RISK OF RUIN BY CAPITAL', fontweight='bold')
        ax2.legend()
        
        # Plot 3: Final capital distribution
        ax3 = fig.add_subplot(2, 2, 3)
        for idx, (B0, (_, _, stats)) in enumerate(results.items()):
            # Generate synthetic distribution for visualization
            mean = stats['mean_final_capital']
            std = stats['std_final_capital']
            x = np.linspace(mean - 3*std, mean + 3*std, 100)
            y = np.exp(-0.5*((x-mean)/std)**2) / (std * np.sqrt(2*np.pi))
            ax3.plot(x, y, color=colors[idx], label=f'B₀=${B0/1e6:.1f}M')
            ax3.axvline(x=mean, color=colors[idx], linestyle='--', alpha=0.5)
        
        ax3.axvline(x=0, color='red', linestyle='-', linewidth=2, label='Ruin')
        ax3.set_xlabel('Final Capital ($)')
        ax3.set_ylabel('Density')
        ax3.set_title('Expected Final Capital Distribution', fontweight='bold')
        ax3.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'${x/1e6:.0f}M'))
        ax3.legend()
        
        # Plot 4: Summary metrics
        ax4 = fig.add_subplot(2, 2, 4)
        ax4.axis('off')
        
        summary = "═══════════════════════════════════════════\n"
        summary += "        STRESS TEST SUMMARY\n"
        summary += "═══════════════════════════════════════════\n\n"
        
        for B0, (_, ror, stats) in results.items():
            summary += f"💰 B₀ = ${B0:,.0f}\n"
            summary += f"   Risk of Ruin:    {ror*100:.2f}%\n"
            summary += f"   Mean Final:      ${stats['mean_final_capital']:,.0f}\n"
            summary += f"   Max Drawdown:    ${stats['max_drawdown_worst']:,.0f}\n"
            summary += f"   CVaR (99.9%):    ${stats['CVaR_99.9']:,.0f}\n\n"
        
        ax4.text(0.1, 0.9, summary, transform=ax4.transAxes, fontsize=11,
                verticalalignment='top', fontfamily='monospace',
                bbox=dict(facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight', facecolor='white')
            print(f"\n📊 Saved: {save_path}")
        
        plt.show()
    
    def generate_report(self, results: Dict, safe_capital: float = None) -> str:
        """Generate final report"""
        lines = [
            "\n" + "=" * 80,
            "MONTE CARLO STRESS TEST - EXECUTIVE SUMMARY",
            "=" * 80,
            "",
            "📊 SIMULATION CONFIGURATION:",
            f"   • Bet Size: ${self.config.bet_size:,.2f}",
            f"   • House Edge: {self.config.house_edge*100:.2f}%",
            f"   • Max Win: ${self.config.max_win:,.0f}",
            f"   • Jackpot Probability: {self.p_jackpot:.2e} (1 in {int(1/self.p_jackpot):,})",
            f"   • Simulated Rounds: {self.config.num_rounds:,}",
            f"   • Independent Walks: {self.config.num_walks:,}",
            "",
            "📈 RESULTS BY CAPITAL LEVEL:",
            "-" * 40,
        ]
        
        for B0, (_, ror, stats) in results.items():
            lines.extend([
                f"\n   💰 Initial Capital: ${B0:,.0f}",
                f"      ├─ Risk of Ruin:      {ror*100:.3f}%",
                f"      ├─ Ruined Count:      {stats['ruined_count']} / {self.config.num_walks}",
                f"      ├─ Mean Final:        ${stats['mean_final_capital']:,.0f}",
                f"      ├─ Std Dev:           ${stats['std_final_capital']:,.0f}",
                f"      ├─ Max Drawdown:      ${stats['max_drawdown_worst']:,.0f}",
                f"      ├─ VaR (99.9%):       ${stats['VaR_99.9']:,.0f}",
                f"      └─ CVaR (99.9%):      ${stats['CVaR_99.9']:,.0f}",
            ])
        
        lines.extend([
            "",
            "=" * 80,
            "🎯 CONCLUSIONS",
            "=" * 80,
            "",
        ])
        
        if safe_capital:
            lines.append(f"✅ RECOMMENDED SAFE CAPITAL: ${safe_capital:,.0f}")
        
        # Calculate recommendation
        worst_cvar = min(s['CVaR_99.9'] for _, (_, _, s) in results.items())
        rec_capital = max(self.config.max_win * 3, abs(worst_cvar) * 3 if worst_cvar < 0 else self.config.max_win * 5)
        
        lines.extend([
            "",
            "💼 CAPITAL RECOMMENDATIONS:",
            f"   • Minimum Operational Capital: ${self.config.max_win * 2:,.0f}",
            f"   • Recommended Safe Capital:    ${rec_capital:,.0f}",
            f"   • Conservative (3x CVaR):      ${max(self.config.max_win * 5, rec_capital):,.0f}",
            "",
            "⚠️  KEY RISK FACTORS:",
            "   • Single jackpot can wipe out months of profit",
            "   • Multiple early jackpots compound risk exponentially",
            "   • Undercapitalization = guaranteed eventual ruin",
            "",
            "=" * 80,
        ])
        
        return "\n".join(lines)


def main():
    print("\n" + "🎰" * 30)
    print("  iGAMING PLATFORM - MONTE CARLO STRESS TEST")
    print("🎰" * 30 + "\n")
    
    config = SimulationConfig(
        bet_size=10.0,
        house_edge=0.02,
        max_win=1_000_000,
        num_rounds=10_000_000,
        num_walks=1_000,
        initial_capitals=[500_000, 1_500_000, 5_000_000],
        seed=42,
        sample_rate=100000
    )
    
    sim = RealisticMonteCarlo(config)
    results = sim.run_all_scenarios()
    
    safe_capital, safe_ror = sim.find_safe_capital(target_ror=0.001)
    print(f"\n🎯 SAFE CAPITAL: ${safe_capital:,.0f} (RoR={safe_ror*100:.3f}%)")
    
    print("\n📊 Generating plots...")
    sim.plot_results(results, save_path='stress_test_results.png')
    
    report = sim.generate_report(results, safe_capital)
    print(report)
    
    with open('stress_test_report.txt', 'w', encoding='utf-8') as f:
        f.write(report)
    
    return results, safe_capital


if __name__ == "__main__":
    results, safe_capital = main()
