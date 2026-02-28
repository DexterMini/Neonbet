"""
================================================================================
MONTE CARLO BANKROLL STRESS TEST - iGAMING PLATFORM
================================================================================
Author: Senior Quant Developer & Actuary
Purpose: Black Swan Event Stress Testing for Crypto iGaming Platform
Model: Heavy-Tail Risk Analysis with Risk of Ruin Estimation

Mathematical Framework:
- RTP (Return to Player) = 98%
- House Edge (HE) = 2%
- Max Win = $1,000,000 (100,000x multiplier)
- Probability calibrated to maintain expected RTP

Key Metrics:
- Risk of Ruin (RoR) per capital scenario
- Safe Capital threshold for RoR < 0.1%
- CVaR (Conditional Value at Risk) at 99.9%
================================================================================
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Tuple, List
import warnings
from dataclasses import dataclass
from concurrent.futures import ProcessPoolExecutor
import time

warnings.filterwarnings('ignore')

# Set style for professional plots
plt.style.use('seaborn-v0_8-darkgrid')


@dataclass
class SimulationConfig:
    """Configuration parameters for the Monte Carlo simulation"""
    bet_size: float = 10.0                    # Transaction/bet size ($b)
    house_edge: float = 0.02                  # House Edge (HE = 2%)
    rtp: float = 0.98                         # Return to Player (98%)
    max_win: float = 1_000_000                # Max Win ($W) - Black Swan event
    max_multiplier: float = 100_000           # 100,000x multiplier
    num_rounds: int = 10_000_000              # Transactions per simulation (N)
    num_walks: int = 1_000                    # Independent simulations
    initial_capitals: List[float] = None     # Starting bankrolls to test
    seed: int = 42                            # Random seed for reproducibility
    
    def __post_init__(self):
        if self.initial_capitals is None:
            self.initial_capitals = [500_000, 1_500_000, 5_000_000]


class MonteCarloBankrollSimulator:
    """
    Advanced Monte Carlo simulator for iGaming bankroll stress testing.
    
    Mathematical Model:
    -------------------
    For a "Jackpot-style" high-volatility game:
    
    Let p = probability of hitting Max Win
    Let q = 1 - p = probability of normal outcome
    
    Expected value per bet for player:
    E[X] = p * W + q * (-b) = RTP * b
    
    Solving for p (probability of max win):
    p * W - b + p*b = RTP * b
    p * (W + b) = b * (RTP + 1)
    
    For extreme volatility modeling:
    p ≈ b / W (simplified for jackpot scenario with near-total loss otherwise)
    
    This gives us: p = 10 / 1,000,000 = 1e-5 (1 in 100,000)
    
    However, for proper RTP maintenance with house edge:
    We model as a mixture: small regular wins + rare jackpot
    """
    
    def __init__(self, config: SimulationConfig):
        self.config = config
        np.random.seed(config.seed)
        
        # Calculate jackpot probability to maintain RTP
        # Using a simplified high-volatility model:
        # Expected return = RTP * bet_size
        # Model: With prob p_jackpot -> win W, else lose bet (or small return)
        
        # For a jackpot slot with RTP = 98%:
        # Let's model it as: 
        # - Probability p_jackpot of winning max_win
        # - Probability p_small of winning 2x bet (small win)
        # - Probability p_lose of losing bet
        
        # For extreme stress test, we use pure jackpot model:
        # p_jackpot * max_win + (1-p_jackpot) * (-bet) = -house_edge * bet
        # p_jackpot = bet * (1 - house_edge) / (max_win + bet)
        
        self.p_jackpot = (config.bet_size * (1 - config.house_edge)) / \
                         (config.max_win + config.bet_size)
        
        # For more realistic model, we'll use a slightly higher probability
        # to create more variance while maintaining approximate RTP
        # This creates a "stress test" scenario
        self.p_jackpot_stress = 1e-5  # 1 in 100,000 for stress testing
        
        print("=" * 70)
        print("MONTE CARLO BANKROLL STRESS TEST - INITIALIZATION")
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
        print(f"Theoretical p(jackpot): {self.p_jackpot:.2e}")
        print(f"Stress test p(jackpot): {self.p_jackpot_stress:.2e}")
        print(f"Expected jackpots/sim:  {self.p_jackpot_stress * config.num_rounds:.1f}")
        print("=" * 70)
    
    def simulate_bankroll_vectorized(self, B0: float, 
                                      use_stress_probability: bool = True) -> Tuple[np.ndarray, float, dict]:
        """
        Vectorized Monte Carlo simulation of bankroll evolution.
        
        Parameters:
        -----------
        B0 : float
            Initial bankroll/capital
        use_stress_probability : bool
            If True, use stress test probability (higher variance)
        
        Returns:
        --------
        Tuple containing:
            - capital_paths: numpy array of shape (walks, rounds)
            - risk_of_ruin: float, percentage of simulations ending in ruin
            - stats: dict with additional statistics
        """
        config = self.config
        walks = config.num_walks
        N = config.num_rounds
        
        p_jackpot = self.p_jackpot_stress if use_stress_probability else self.p_jackpot
        
        # Expected profit per normal round (house edge on losing bets)
        # House wins bet_size with probability (1 - p_jackpot)
        # House loses (max_win - bet_size) with probability p_jackpot
        expected_profit_per_round = config.bet_size * config.house_edge
        
        print(f"\nSimulating B₀ = ${B0:,}...")
        start_time = time.time()
        
        # Generate jackpot occurrences (vectorized)
        # This is more memory efficient than generating full random matrix
        jackpot_counts = np.random.binomial(N, p_jackpot, size=walks)
        
        # For each walk, determine WHEN jackpots occur
        capital_paths = np.zeros((walks, N))
        ruined = np.zeros(walks, dtype=bool)
        ruin_round = np.full(walks, N)  # Round at which ruin occurred
        min_capital = np.zeros(walks)
        max_drawdown = np.zeros(walks)
        
        # Base profit accumulation (house edge per round)
        base_profit = np.cumsum(np.full(N, expected_profit_per_round))
        
        for w in range(walks):
            # Start with initial capital
            path = B0 + base_profit.copy()
            
            # Generate jackpot positions for this walk
            num_jackpots = jackpot_counts[w]
            if num_jackpots > 0:
                jackpot_positions = np.sort(np.random.choice(N, size=num_jackpots, replace=False))
                
                # Apply jackpot losses (house pays out max_win)
                jackpot_loss = config.max_win - config.bet_size  # Net loss to house
                
                for jp in jackpot_positions:
                    path[jp:] -= jackpot_loss
            
            capital_paths[w] = path
            
            # Check for ruin
            min_idx = np.argmin(path)
            min_capital[w] = path[min_idx]
            
            if np.any(path <= 0):
                ruined[w] = True
                ruin_round[w] = np.where(path <= 0)[0][0]
            
            # Calculate max drawdown
            running_max = np.maximum.accumulate(path)
            drawdowns = running_max - path
            max_drawdown[w] = np.max(drawdowns)
        
        elapsed = time.time() - start_time
        
        risk_of_ruin = ruined.mean()
        
        # Calculate additional statistics
        stats = {
            'risk_of_ruin': risk_of_ruin,
            'mean_final_capital': capital_paths[:, -1].mean(),
            'std_final_capital': capital_paths[:, -1].std(),
            'median_final_capital': np.median(capital_paths[:, -1]),
            'min_capital_observed': min_capital.min(),
            'mean_min_capital': min_capital.mean(),
            'max_drawdown_mean': max_drawdown.mean(),
            'max_drawdown_worst': max_drawdown.max(),
            'ruined_count': ruined.sum(),
            'mean_ruin_round': ruin_round[ruined].mean() if ruined.any() else N,
            'earliest_ruin': ruin_round[ruined].min() if ruined.any() else N,
            'simulation_time': elapsed,
            'total_jackpots': jackpot_counts.sum(),
            'mean_jackpots_per_walk': jackpot_counts.mean(),
        }
        
        # CVaR calculation (Conditional Value at Risk at 99.9%)
        final_capitals = capital_paths[:, -1]
        var_99_9 = np.percentile(final_capitals, 0.1)
        cvar_99_9 = final_capitals[final_capitals <= var_99_9].mean() if (final_capitals <= var_99_9).any() else var_99_9
        stats['VaR_99.9'] = var_99_9
        stats['CVaR_99.9'] = cvar_99_9
        
        print(f"  Completed in {elapsed:.2f}s | RoR: {risk_of_ruin*100:.3f}% | "
              f"Avg Jackpots: {jackpot_counts.mean():.1f}")
        
        return capital_paths, risk_of_ruin, stats
    
    def run_all_scenarios(self) -> Dict[float, Tuple[np.ndarray, float, dict]]:
        """Run simulations for all initial capital scenarios"""
        results = {}
        
        print("\n" + "=" * 70)
        print("RUNNING SIMULATIONS FOR ALL CAPITAL SCENARIOS")
        print("=" * 70)
        
        for B0 in self.config.initial_capitals:
            paths, ror, stats = self.simulate_bankroll_vectorized(B0)
            results[B0] = (paths, ror, stats)
        
        return results
    
    def find_safe_capital(self, target_ror: float = 0.001, 
                          min_capital: float = 1_000_000,
                          max_capital: float = 20_000_000,
                          tolerance: float = 0.0005) -> float:
        """
        Binary search to find the minimum capital for RoR < target.
        
        Parameters:
        -----------
        target_ror : float
            Target Risk of Ruin threshold (default 0.1% = 0.001)
        min_capital : float
            Lower bound for search
        max_capital : float
            Upper bound for search
        tolerance : float
            Acceptable tolerance for RoR
        
        Returns:
        --------
        float : Safe capital amount
        """
        print("\n" + "=" * 70)
        print(f"FINDING SAFE CAPITAL FOR RoR < {target_ror*100:.2f}%")
        print("=" * 70)
        
        low, high = min_capital, max_capital
        best_safe = max_capital
        iterations = 0
        max_iterations = 15
        
        while high - low > 100_000 and iterations < max_iterations:
            mid = (low + high) / 2
            _, ror, _ = self.simulate_bankroll_vectorized(mid)
            iterations += 1
            
            print(f"  Iteration {iterations}: B₀=${mid:,.0f} -> RoR={ror*100:.3f}%")
            
            if ror <= target_ror:
                best_safe = mid
                high = mid
            else:
                low = mid
        
        # Final verification with more walks
        print(f"\nVerifying safe capital: ${best_safe:,.0f}")
        original_walks = self.config.num_walks
        self.config.num_walks = 2000  # More walks for verification
        _, final_ror, _ = self.simulate_bankroll_vectorized(best_safe)
        self.config.num_walks = original_walks
        
        return best_safe, final_ror
    
    def plot_results(self, results: Dict[float, Tuple[np.ndarray, float, dict]], 
                     save_path: str = None):
        """Generate comprehensive visualization of simulation results"""
        
        fig = plt.figure(figsize=(20, 16))
        
        colors = ['#e74c3c', '#f39c12', '#27ae60']  # Red, Orange, Green
        
        # Plot 1: Sample paths for all scenarios (top left)
        ax1 = fig.add_subplot(2, 2, 1)
        for idx, (B0, (paths, ror, stats)) in enumerate(results.items()):
            color = colors[idx]
            # Plot 20 random sample paths
            sample_indices = np.random.choice(paths.shape[0], size=20, replace=False)
            for i in sample_indices:
                ax1.plot(paths[i], alpha=0.3, color=color, linewidth=0.5)
            # Add mean path
            mean_path = paths.mean(axis=0)
            ax1.plot(mean_path, color=color, linewidth=2, 
                    label=f'B₀=${B0/1e6:.1f}M (RoR={ror*100:.2f}%)')
        
        ax1.axhline(y=0, color='black', linestyle='--', linewidth=2, label='Ruin Threshold')
        ax1.set_xlabel('Round Number', fontsize=12)
        ax1.set_ylabel('Bankroll ($)', fontsize=12)
        ax1.set_title('Bankroll Evolution - Monte Carlo Paths\n(20 sample paths per scenario + mean)', 
                     fontsize=14, fontweight='bold')
        ax1.legend(loc='upper left', fontsize=10)
        ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x/1e6:.1f}M'))
        ax1.grid(True, alpha=0.3)
        
        # Plot 2: Zoom on Black Swan events (top right)
        ax2 = fig.add_subplot(2, 2, 2)
        # Find paths with early ruin for dramatic effect
        B0_low = self.config.initial_capitals[0]
        paths_low = results[B0_low][0]
        
        # Find paths that went to ruin
        ruined_mask = np.any(paths_low <= 0, axis=1)
        if ruined_mask.any():
            ruined_paths = paths_low[ruined_mask][:10]  # First 10 ruined paths
            for i, path in enumerate(ruined_paths):
                ruin_point = np.where(path <= 0)[0][0] if (path <= 0).any() else len(path)
                ax2.plot(path[:min(ruin_point+1000, len(path))], 
                        alpha=0.7, linewidth=1.5, label=f'Path {i+1}' if i < 3 else '')
        
        ax2.axhline(y=0, color='red', linestyle='--', linewidth=2)
        ax2.set_xlabel('Round Number', fontsize=12)
        ax2.set_ylabel('Bankroll ($)', fontsize=12)
        ax2.set_title(f'BLACK SWAN EVENTS - Paths to Ruin\n(B₀=${B0_low/1e6:.1f}M Scenario)', 
                     fontsize=14, fontweight='bold', color='darkred')
        ax2.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x/1e6:.1f}M'))
        ax2.grid(True, alpha=0.3)
        ax2.legend(loc='upper right', fontsize=9)
        
        # Plot 3: Risk of Ruin comparison (bottom left)
        ax3 = fig.add_subplot(2, 2, 3)
        capitals = list(results.keys())
        rors = [results[B0][1] * 100 for B0 in capitals]
        
        bars = ax3.bar([f'${B0/1e6:.1f}M' for B0 in capitals], rors, color=colors, 
                       edgecolor='black', linewidth=2)
        
        # Add value labels
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
        
        # Plot 4: Final capital distribution (bottom right)
        ax4 = fig.add_subplot(2, 2, 4)
        for idx, (B0, (paths, ror, stats)) in enumerate(results.items()):
            final_capitals = paths[:, -1]
            ax4.hist(final_capitals, bins=50, alpha=0.5, color=colors[idx], 
                    label=f'B₀=${B0/1e6:.1f}M', edgecolor='black')
        
        ax4.axvline(x=0, color='red', linestyle='--', linewidth=2, label='Ruin')
        ax4.set_xlabel('Final Bankroll ($)', fontsize=12)
        ax4.set_ylabel('Frequency', fontsize=12)
        ax4.set_title('FINAL CAPITAL DISTRIBUTION\n(After 10M Rounds)', 
                     fontsize=14, fontweight='bold')
        ax4.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x/1e6:.1f}M'))
        ax4.legend(loc='upper right', fontsize=10)
        ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight', 
                       facecolor='white', edgecolor='none')
            print(f"\nPlot saved to: {save_path}")
        
        plt.show()
        
        return fig
    
    def generate_report(self, results: Dict[float, Tuple[np.ndarray, float, dict]], 
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
        
        # Analyze results
        min_capital_safe = None
        for B0, (_, ror, _) in sorted(results.items()):
            if ror < 0.001:  # Less than 0.1%
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
        
        # Calculate recommended capital based on CVaR
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
    
    # Initialize configuration
    config = SimulationConfig(
        bet_size=10.0,
        house_edge=0.02,
        rtp=0.98,
        max_win=1_000_000,
        max_multiplier=100_000,
        num_rounds=10_000_000,
        num_walks=1_000,
        initial_capitals=[500_000, 1_500_000, 5_000_000],
        seed=42
    )
    
    # Initialize simulator
    simulator = MonteCarloBankrollSimulator(config)
    
    # Run all scenarios
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
    
    # Save report to file
    with open('stress_test_report.txt', 'w', encoding='utf-8') as f:
        f.write(report)
    print("\n📄 Report saved to: stress_test_report.txt")
    
    return results, safe_capital


if __name__ == "__main__":
    results, safe_capital = main()
