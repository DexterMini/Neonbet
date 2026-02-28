"""
================================================================================
MONTE CARLO BANKROLL STRESS TEST - MEMORY-OPTIMIZED VERSION
================================================================================
Author: Senior Quant Developer & Actuary
Purpose: Black Swan Event Stress Testing for Crypto iGaming Platform
Model: Heavy-Tail Risk Analysis with Risk of Ruin Estimation

Optimized for systems with limited RAM - processes walks in batches
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
    """Configuration parameters for the Monte Carlo simulation"""
    bet_size: float = 10.0
    house_edge: float = 0.02
    rtp: float = 0.98
    max_win: float = 1_000_000
    max_multiplier: float = 100_000
    num_rounds: int = 10_000_000
    num_walks: int = 1_000
    initial_capitals: List[float] = None
    seed: int = 42
    # Sampling for visualization (store every Nth point)
    sample_rate: int = 10000
    
    def __post_init__(self):
        if self.initial_capitals is None:
            self.initial_capitals = [500_000, 1_500_000, 5_000_000]


class MonteCarloBankrollSimulator:
    """
    Memory-optimized Monte Carlo simulator for iGaming bankroll stress testing.
    
    Key optimization: Instead of storing full paths (walks × rounds matrix),
    we process one walk at a time and only store sampled points for visualization.
    """
    
    def __init__(self, config: SimulationConfig):
        self.config = config
        np.random.seed(config.seed)
        
        # Calculate jackpot probability
        self.p_jackpot = (config.bet_size * (1 - config.house_edge)) / \
                         (config.max_win + config.bet_size)
        self.p_jackpot_stress = 1e-5  # 1 in 100,000
        
        print("=" * 70)
        print("MONTE CARLO BANKROLL STRESS TEST - MEMORY OPTIMIZED")
        print("=" * 70)
        print(f"Bet Size (b):           ${config.bet_size:,.2f}")
        print(f"House Edge (HE):        {config.house_edge * 100:.2f}%")
        print(f"RTP:                    {config.rtp * 100:.2f}%")
        print(f"Max Win (W):            ${config.max_win:,.0f}")
        print(f"Max Multiplier:         {config.max_multiplier:,.0f}x")
        print(f"Rounds per simulation:  {config.num_rounds:,}")
        print(f"Number of walks:        {config.num_walks:,}")
        print(f"Initial capitals:       {[f'${x:,}' for x in config.initial_capitals]}")
        print("-" * 70)
        print(f"Stress test p(jackpot): {self.p_jackpot_stress:.2e}")
        print(f"Expected jackpots/sim:  {self.p_jackpot_stress * config.num_rounds:.1f}")
        print("=" * 70)
    
    def simulate_single_walk(self, B0: float, store_path: bool = False) -> dict:
        """
        Simulate a single random walk of bankroll evolution.
        Memory efficient - only tracks key metrics.
        """
        config = self.config
        N = config.num_rounds
        p_jackpot = self.p_jackpot_stress
        
        # Expected profit per round
        profit_per_round = config.bet_size * config.house_edge
        jackpot_loss = config.max_win - config.bet_size
        
        # Generate jackpot occurrences for this walk
        num_jackpots = np.random.binomial(N, p_jackpot)
        jackpot_positions = np.sort(np.random.choice(N, size=num_jackpots, replace=False)) if num_jackpots > 0 else np.array([])
        
        # Track metrics
        current_capital = B0
        min_capital = B0
        max_capital = B0
        ruined = False
        ruin_round = N
        max_drawdown = 0
        peak = B0
        
        # For path storage (sampled)
        sampled_path = [] if store_path else None
        sample_rate = config.sample_rate
        
        jackpot_idx = 0
        
        for round_num in range(N):
            # Add regular profit
            current_capital += profit_per_round
            
            # Check for jackpot at this round
            if jackpot_idx < len(jackpot_positions) and jackpot_positions[jackpot_idx] == round_num:
                current_capital -= jackpot_loss
                jackpot_idx += 1
            
            # Update tracking metrics
            if current_capital > peak:
                peak = current_capital
            
            drawdown = peak - current_capital
            if drawdown > max_drawdown:
                max_drawdown = drawdown
            
            if current_capital < min_capital:
                min_capital = current_capital
            
            if current_capital > max_capital:
                max_capital = current_capital
            
            # Check for ruin
            if current_capital <= 0 and not ruined:
                ruined = True
                ruin_round = round_num
                if not store_path:
                    break  # No need to continue if not storing path
            
            # Sample path for visualization
            if store_path and (round_num % sample_rate == 0 or round_num == N - 1):
                sampled_path.append((round_num, current_capital))
        
        return {
            'final_capital': current_capital,
            'min_capital': min_capital,
            'max_capital': max_capital,
            'ruined': ruined,
            'ruin_round': ruin_round,
            'max_drawdown': max_drawdown,
            'num_jackpots': num_jackpots,
            'sampled_path': sampled_path
        }
    
    def simulate_bankroll(self, B0: float, num_paths_to_store: int = 50) -> Tuple[list, float, dict]:
        """
        Run all walks for a given initial capital.
        Memory efficient - processes walks sequentially.
        """
        config = self.config
        walks = config.num_walks
        
        print(f"\nSimulating B₀ = ${B0:,}...")
        start_time = time.time()
        
        # Metrics to track across all walks
        final_capitals = []
        ruined_count = 0
        ruin_rounds = []
        min_capitals = []
        max_drawdowns = []
        total_jackpots = 0
        
        # Store some paths for visualization
        stored_paths = []
        
        for w in range(walks):
            # Store path for first N walks for visualization
            store_path = w < num_paths_to_store
            
            result = self.simulate_single_walk(B0, store_path=store_path)
            
            final_capitals.append(result['final_capital'])
            min_capitals.append(result['min_capital'])
            max_drawdowns.append(result['max_drawdown'])
            total_jackpots += result['num_jackpots']
            
            if result['ruined']:
                ruined_count += 1
                ruin_rounds.append(result['ruin_round'])
            
            if store_path:
                stored_paths.append(result['sampled_path'])
            
            # Progress indicator
            if (w + 1) % 100 == 0:
                print(f"  Progress: {w + 1}/{walks} walks completed...", end='\r')
        
        elapsed = time.time() - start_time
        
        final_capitals = np.array(final_capitals)
        min_capitals = np.array(min_capitals)
        max_drawdowns = np.array(max_drawdowns)
        
        risk_of_ruin = ruined_count / walks
        
        # Calculate statistics
        stats = {
            'risk_of_ruin': risk_of_ruin,
            'mean_final_capital': final_capitals.mean(),
            'std_final_capital': final_capitals.std(),
            'median_final_capital': np.median(final_capitals),
            'min_capital_observed': min_capitals.min(),
            'mean_min_capital': min_capitals.mean(),
            'max_drawdown_mean': max_drawdowns.mean(),
            'max_drawdown_worst': max_drawdowns.max(),
            'ruined_count': ruined_count,
            'mean_ruin_round': np.mean(ruin_rounds) if ruin_rounds else config.num_rounds,
            'earliest_ruin': min(ruin_rounds) if ruin_rounds else config.num_rounds,
            'simulation_time': elapsed,
            'total_jackpots': total_jackpots,
            'mean_jackpots_per_walk': total_jackpots / walks,
        }
        
        # CVaR calculation
        var_99_9 = np.percentile(final_capitals, 0.1)
        tail_values = final_capitals[final_capitals <= var_99_9]
        cvar_99_9 = tail_values.mean() if len(tail_values) > 0 else var_99_9
        stats['VaR_99.9'] = var_99_9
        stats['CVaR_99.9'] = cvar_99_9
        
        print(f"  Completed in {elapsed:.2f}s | RoR: {risk_of_ruin*100:.3f}% | "
              f"Avg Jackpots: {total_jackpots/walks:.1f}")
        
        return stored_paths, risk_of_ruin, stats
    
    def run_all_scenarios(self) -> Dict[float, Tuple[list, float, dict]]:
        """Run simulations for all initial capital scenarios"""
        results = {}
        
        print("\n" + "=" * 70)
        print("RUNNING SIMULATIONS FOR ALL CAPITAL SCENARIOS")
        print("=" * 70)
        
        for B0 in self.config.initial_capitals:
            paths, ror, stats = self.simulate_bankroll(B0)
            results[B0] = (paths, ror, stats)
        
        return results
    
    def find_safe_capital(self, target_ror: float = 0.001,
                          min_capital: float = 3_000_000,
                          max_capital: float = 15_000_000) -> Tuple[float, float]:
        """Binary search to find minimum capital for RoR < target"""
        print("\n" + "=" * 70)
        print(f"FINDING SAFE CAPITAL FOR RoR < {target_ror*100:.2f}%")
        print("=" * 70)
        
        low, high = min_capital, max_capital
        best_safe = max_capital
        iterations = 0
        max_iterations = 10
        
        # Use fewer walks for search (faster)
        original_walks = self.config.num_walks
        self.config.num_walks = 500
        
        while high - low > 500_000 and iterations < max_iterations:
            mid = (low + high) / 2
            _, ror, _ = self.simulate_bankroll(mid, num_paths_to_store=0)
            iterations += 1
            
            print(f"  Iteration {iterations}: B₀=${mid:,.0f} -> RoR={ror*100:.3f}%")
            
            if ror <= target_ror:
                best_safe = mid
                high = mid
            else:
                low = mid
        
        # Final verification with more walks
        print(f"\nVerifying safe capital: ${best_safe:,.0f}")
        self.config.num_walks = 1000
        _, final_ror, _ = self.simulate_bankroll(best_safe, num_paths_to_store=0)
        self.config.num_walks = original_walks
        
        return best_safe, final_ror
    
    def plot_results(self, results: Dict[float, Tuple[list, float, dict]],
                     save_path: str = None):
        """Generate comprehensive visualization"""
        
        fig = plt.figure(figsize=(20, 16))
        colors = ['#e74c3c', '#f39c12', '#27ae60']
        
        # Plot 1: Sample paths
        ax1 = fig.add_subplot(2, 2, 1)
        for idx, (B0, (paths, ror, stats)) in enumerate(results.items()):
            color = colors[idx]
            for i, path in enumerate(paths[:20]):  # Plot 20 paths
                if path:
                    rounds, capitals = zip(*path)
                    ax1.plot(rounds, capitals, alpha=0.4, color=color, linewidth=0.8)
        
        ax1.axhline(y=0, color='black', linestyle='--', linewidth=2, label='Ruin Threshold')
        ax1.set_xlabel('Round Number', fontsize=12)
        ax1.set_ylabel('Bankroll ($)', fontsize=12)
        ax1.set_title('Bankroll Evolution - Monte Carlo Paths\n(20 sample paths per scenario)', 
                     fontsize=14, fontweight='bold')
        ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x/1e6:.1f}M'))
        ax1.grid(True, alpha=0.3)
        
        # Add legend
        for idx, B0 in enumerate(results.keys()):
            ror = results[B0][1]
            ax1.plot([], [], color=colors[idx], linewidth=2, 
                    label=f'B₀=${B0/1e6:.1f}M (RoR={ror*100:.2f}%)')
        ax1.legend(loc='upper left', fontsize=10)
        
        # Plot 2: Zoom on Black Swan (ruined paths)
        ax2 = fig.add_subplot(2, 2, 2)
        B0_low = self.config.initial_capitals[0]
        paths_low = results[B0_low][0]
        
        ruined_shown = 0
        for path in paths_low:
            if path:
                rounds, capitals = zip(*path)
                if min(capitals) <= 0:  # This path hit ruin
                    ax2.plot(rounds, capitals, alpha=0.7, linewidth=1.5)
                    ruined_shown += 1
                    if ruined_shown >= 10:
                        break
        
        ax2.axhline(y=0, color='red', linestyle='--', linewidth=2)
        ax2.set_xlabel('Round Number', fontsize=12)
        ax2.set_ylabel('Bankroll ($)', fontsize=12)
        ax2.set_title(f'BLACK SWAN EVENTS - Paths to Ruin\n(B₀=${B0_low/1e6:.1f}M Scenario)', 
                     fontsize=14, fontweight='bold', color='darkred')
        ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x/1e6:.1f}M'))
        ax2.grid(True, alpha=0.3)
        
        # Plot 3: Risk of Ruin comparison
        ax3 = fig.add_subplot(2, 2, 3)
        capitals = list(results.keys())
        rors = [results[B0][1] * 100 for B0 in capitals]
        
        bars = ax3.bar([f'${B0/1e6:.1f}M' for B0 in capitals], rors, color=colors,
                       edgecolor='black', linewidth=2)
        
        for bar, ror in zip(bars, rors):
            height = bar.get_height()
            ax3.annotate(f'{ror:.2f}%',
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 3), textcoords="offset points",
                        ha='center', va='bottom', fontsize=14, fontweight='bold')
        
        ax3.axhline(y=0.1, color='green', linestyle='--', linewidth=2,
                   label='Target RoR < 0.1%')
        ax3.set_xlabel('Initial Bankroll', fontsize=12)
        ax3.set_ylabel('Risk of Ruin (%)', fontsize=12)
        ax3.set_title('RISK OF RUIN BY CAPITAL LEVEL', fontsize=14, fontweight='bold')
        ax3.legend(loc='upper right', fontsize=10)
        ax3.grid(True, alpha=0.3, axis='y')
        
        # Plot 4: Key metrics summary
        ax4 = fig.add_subplot(2, 2, 4)
        ax4.axis('off')
        
        summary_text = "📊 SIMULATION SUMMARY\n" + "=" * 50 + "\n\n"
        for idx, (B0, (_, ror, stats)) in enumerate(results.items()):
            summary_text += f"💰 Initial Capital: ${B0:,.0f}\n"
            summary_text += f"   ├─ Risk of Ruin:      {ror*100:.3f}%\n"
            summary_text += f"   ├─ Ruined Count:      {stats['ruined_count']:,}\n"
            summary_text += f"   ├─ Mean Final:        ${stats['mean_final_capital']:,.0f}\n"
            summary_text += f"   ├─ Worst Drawdown:    ${stats['max_drawdown_worst']:,.0f}\n"
            summary_text += f"   ├─ Earliest Ruin:     Round {stats['earliest_ruin']:,}\n"
            summary_text += f"   └─ CVaR (99.9%):      ${stats['CVaR_99.9']:,.0f}\n\n"
        
        ax4.text(0.1, 0.95, summary_text, transform=ax4.transAxes, fontsize=11,
                verticalalignment='top', fontfamily='monospace',
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight',
                       facecolor='white', edgecolor='none')
            print(f"\n📊 Plot saved to: {save_path}")
        
        plt.show()
        
        return fig
    
    def generate_report(self, results: Dict[float, Tuple[list, float, dict]],
                        safe_capital: float = None) -> str:
        """Generate comprehensive analysis report"""
        
        report = []
        report.append("\n" + "=" * 80)
        report.append("MONTE CARLO BANKROLL STRESS TEST - FINAL REPORT")
        report.append("=" * 80)
        
        report.append("\n📊 SIMULATION PARAMETERS:")
        report.append("-" * 40)
        report.append(f"  • Bet Size:              ${self.config.bet_size:,.2f}")
        report.append(f"  • House Edge:            {self.config.house_edge * 100:.2f}%")
        report.append(f"  • RTP:                   {self.config.rtp * 100:.2f}%")
        report.append(f"  • Max Win (Black Swan):  ${self.config.max_win:,.0f}")
        report.append(f"  • Rounds per simulation: {self.config.num_rounds:,}")
        report.append(f"  • Independent walks:     {self.config.num_walks:,}")
        report.append(f"  • Jackpot probability:   {self.p_jackpot_stress:.2e} (1 in {int(1/self.p_jackpot_stress):,})")
        
        report.append("\n📈 RESULTS BY INITIAL CAPITAL:")
        report.append("-" * 40)
        
        for B0, (paths, ror, stats) in results.items():
            report.append(f"\n  💰 Initial Capital: ${B0:,.0f}")
            report.append(f"     ├─ Risk of Ruin:        {ror * 100:.3f}%")
            report.append(f"     ├─ Ruined simulations:  {stats['ruined_count']:,} / {self.config.num_walks:,}")
            report.append(f"     ├─ Mean final capital:  ${stats['mean_final_capital']:,.0f}")
            report.append(f"     ├─ Std final capital:   ${stats['std_final_capital']:,.0f}")
            report.append(f"     ├─ Worst drawdown:      ${stats['max_drawdown_worst']:,.0f}")
            report.append(f"     ├─ Earliest ruin:       Round {stats['earliest_ruin']:,}")
            report.append(f"     ├─ VaR (99.9%):         ${stats['VaR_99.9']:,.0f}")
            report.append(f"     └─ CVaR (99.9%):        ${stats['CVaR_99.9']:,.0f}")
        
        report.append("\n" + "=" * 80)
        report.append("🎯 CONCLUSIONS & RECOMMENDATIONS")
        report.append("=" * 80)
        
        min_capital_safe = None
        for B0, (_, ror, _) in sorted(results.items()):
            if ror < 0.001:
                min_capital_safe = B0
                break
        
        if safe_capital:
            report.append(f"\n✅ SAFE BANKROLL (RoR < 0.1%): ${safe_capital:,.0f}")
        elif min_capital_safe:
            report.append(f"\n✅ SAFE BANKROLL (RoR < 0.1%): ${min_capital_safe:,.0f}")
        else:
            report.append("\n⚠️  NO TESTED CAPITAL MEETS RoR < 0.1% THRESHOLD")
            report.append("    Recommend: Increase capital beyond $5,000,000")
        
        report.append("\n📋 KEY INSIGHTS:")
        report.append("-" * 40)
        report.append("  1. Black Swan events (Max Win payouts) can occur at ANY time")
        report.append("  2. Even with 2% house edge, early variance can cause ruin")
        report.append("  3. Undercapitalization is the #1 cause of platform failure")
        report.append("  4. Capital requirement scales with max_win, not average bet")
        
        report.append("\n💼 INVESTOR-GRADE METRICS:")
        report.append("-" * 40)
        
        worst_cvar = min(stats['CVaR_99.9'] for _, (_, _, stats) in results.items())
        recommended_capital = abs(worst_cvar) * 3 if worst_cvar < 0 else self.config.max_win * 5
        
        report.append(f"  • Recommended Minimum Capital: ${recommended_capital:,.0f}")
        report.append(f"  • Safety Factor Applied:       3x CVaR(99.9%)")
        report.append(f"  • Max Single Event Exposure:   ${self.config.max_win:,.0f}")
        
        report.append("\n⚠️  RISK WARNINGS:")
        report.append("-" * 40)
        report.append("  • This simulation assumes independent events")
        report.append("  • Real-world correlation could increase risk")
        report.append("  • Crypto volatility adds additional market risk")
        report.append("  • Regulatory capital requirements may be higher")
        
        report.append("\n" + "=" * 80)
        
        return "\n".join(report)


def main():
    """Main execution function"""
    
    print("\n" + "🎰" * 35)
    print("  CRYPTO iGAMING PLATFORM - MONTE CARLO STRESS TEST")
    print("🎰" * 35 + "\n")
    
    config = SimulationConfig(
        bet_size=10.0,
        house_edge=0.02,
        rtp=0.98,
        max_win=1_000_000,
        max_multiplier=100_000,
        num_rounds=10_000_000,
        num_walks=1_000,
        initial_capitals=[500_000, 1_500_000, 5_000_000],
        seed=42,
        sample_rate=50000  # Sample every 50k rounds for visualization
    )
    
    simulator = MonteCarloBankrollSimulator(config)
    results = simulator.run_all_scenarios()
    
    # Find safe capital
    safe_capital, safe_ror = simulator.find_safe_capital(
        target_ror=0.001,
        min_capital=3_000_000,
        max_capital=15_000_000
    )
    
    print(f"\n🎯 SAFE CAPITAL FOUND: ${safe_capital:,.0f} (RoR = {safe_ror*100:.3f}%)")
    
    # Generate visualizations
    print("\n📊 Generating visualizations...")
    simulator.plot_results(results, save_path='bankroll_stress_test.png')
    
    # Generate and print report
    report = simulator.generate_report(results, safe_capital)
    print(report)
    
    # Save report
    with open('stress_test_report.txt', 'w', encoding='utf-8') as f:
        f.write(report)
    print("\n📄 Report saved to: stress_test_report.txt")
    
    return results, safe_capital


if __name__ == "__main__":
    results, safe_capital = main()
