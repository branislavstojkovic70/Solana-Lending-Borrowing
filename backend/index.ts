import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";


const CONFIG = {
  rpcUrl: "http://127.0.0.1:8899",
  
  programId: new PublicKey("HUiEdjMzMgLtNsqnz6VW8HogCMMSojNLSf5gHLmV7N9b"),
  
  initialLiquidity: {
    usdc: new BN(100_000 * 10**6), 
  },
  
  reserves: {
    usdc: {
      optimalUtilizationRate: 90,
      loanToValueRatio: 80,
      liquidationBonus: 5,
      liquidationThreshold: 85,
      minBorrowRate: 0,
      optimalBorrowRate: 8,
      maxBorrowRate: 50,
      borrowFeeWad: new BN("100000000000000"), 
      flashLoanFeeWad: new BN("3000000000000000"),
      hostFeePercentage: 20,
    },
  },
  
  refreshIntervalSeconds: 30,
  minSlotsSinceUpdate: 120, // ~60 seconds
};

const IDL = {
  address: "HUiEdjMzMgLtNsqnz6VW8HogCMMSojNLSf5gHLmV7N9b",
  metadata: {
    name: "lendborrow",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "init_lending_market",
      discriminator: [34, 162, 116, 14, 101, 137, 94, 239],
      accounts: [
        { name: "owner", writable: true, signer: true },
        { name: "lending_market", writable: true },
        { name: "token_program" },
        { name: "system_program" },
      ],
      args: [
        { name: "quote_currency", type: { array: ["u8", 32] } },
      ],
    },
    {
      name: "init_reserve",
      discriminator: [138, 245, 71, 225, 153, 4, 3, 43],
      accounts: [
        { name: "source_liquidity", writable: true },
        { name: "liquidity_mint" },
        { name: "lending_market" },
        { name: "lending_market_authority" },
        { name: "reserve", writable: true },
        { name: "liquidity_supply", writable: true },
        { name: "liquidity_fee_receiver", writable: true },
        { name: "pyth_price" },
        { name: "collateral_mint", writable: true },
        { name: "destination_collateral", writable: true },
        { name: "collateral_supply", writable: true },
        { name: "owner", writable: true, signer: true },
        { name: "user_transfer_authority", signer: true },
        { name: "token_program" },
        { name: "associated_token_program" },
        { name: "system_program" },
        { name: "rent" },
      ],
      args: [
        { name: "liquidity_amount", type: "u64" },
        { name: "config", type: { defined: { name: "ReserveConfig" } } },
      ],
    },
    {
      name: "refresh_reserve",
      discriminator: [2, 218, 138, 235, 79, 201, 25, 102],
      accounts: [
        { name: "reserve", writable: true },
        { name: "lending_market" },
        { name: "pyth_price" },
      ],
      args: [],
    },
  ],
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(section: string, message: string, icon: string = "📝") {
  console.log(`${icon} ${section}: ${message}`);
}

function logSection(title: string) {
  console.log("\n" + "═".repeat(70));
  console.log(`  ${title}`);
  console.log("═".repeat(70) + "\n");
}

async function airdropIfNeeded(
  connection: Connection, 
  pubkey: PublicKey, 
  minBalance: number = 5
): Promise<void> {
  const balance = await connection.getBalance(pubkey);
  if (balance < minBalance * LAMPORTS_PER_SOL) {
    log("Airdrop", `Requesting ${minBalance} SOL...`, "💰");
    const sig = await connection.requestAirdrop(
      pubkey, 
      minBalance * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);
    log("Airdrop", "Confirmed!", "✅");
  }
}

async function main() {
  console.clear();
  console.log("\n" + "═".repeat(70));
  console.log("  🚀 LENDBORROW - COMPLETE FLOW");
  console.log("═".repeat(70));
  console.log("");
  console.log("  This script will:");
  console.log("  ✅ Initialize lending market");
  console.log("  ✅ Create mock USDC token");
  console.log("  ✅ Initialize USDC reserve");
  console.log("  ✅ Deposit initial liquidity");
  console.log("  ✅ Start refresh keeper bot");
  console.log("");
  console.log("═".repeat(70) + "\n");
  
  await sleep(2000);
  

  logSection("🔧 SETUP");
  
  const connection = new Connection(CONFIG.rpcUrl, "confirmed");
  log("RPC", CONFIG.rpcUrl, "📡");
  
  const wallet = new Wallet(Keypair.generate());
  log("Wallet", wallet.publicKey.toBase58(), "👛");
  
  if (CONFIG.rpcUrl.includes("localhost") || CONFIG.rpcUrl.includes("127.0.0.1")) {
    await airdropIfNeeded(connection, wallet.publicKey, 10);
  }
  
  const balance = await connection.getBalance(wallet.publicKey);
  log("Balance", `${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`, "💰");
  
  const provider = new AnchorProvider(connection, wallet, { 
    commitment: "confirmed" 
  });
  const program = new Program(IDL as any, provider);
  
  log("Program", program.programId.toBase58().slice(0, 20) + "...", "📦");
  
  await sleep(1000);
  
  logSection("STEP 1: Initialize Lending Market");
  //@ts-ignore
  const [lendingMarket, marketBump] = PublicKey.findProgramAddressSync(
    //@ts-ignore
    [Buffer.from("lending-market"), wallet.publicKey.toBuffer()],
    program.programId
  );
  
  log("PDA", lendingMarket.toBase58(), "🏦");
  log("Bump", marketBump.toString(), "🎯");
  
  // Check if market exists
  let marketAccount = null;
  try {
    marketAccount = await connection.getAccountInfo(lendingMarket);
  } catch {}
  
  if (marketAccount) {
    log("Status", "Already initialized!", "✅");
  } else {
    log("Status", "Initializing...", "🔄");
    
    //@ts-ignore
    const quoteCurrency = Buffer.alloc(32);
    //@ts-ignore
    Buffer.from("USD").copy(quoteCurrency);
    
    try {
      const tx = await program.methods
        .initLendingMarket(Array.from(quoteCurrency))
        .accounts({
          owner: wallet.publicKey,
          lendingMarket: lendingMarket,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      log("Transaction", tx.slice(0, 16) + "...", "✅");
      log("Status", "Initialized successfully!", "🎉");
    } catch (error: any) {
      log("Error", error.message, "❌");
      //@ts-ignore
      process.exit(1);
    }
  }
  
  await sleep(1000);
  
  logSection("STEP 2: Create Mock USDC Token");
  
  log("Status", "Creating USDC mint...", "🔄");
  
  const usdcMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    wallet.publicKey,
    6 
  );
  
  log("USDC Mint", usdcMint.toBase58(), "💵");
  
  const userUsdcAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    usdcMint,
    wallet.publicKey
  );
  
  log("User Account", userUsdcAccount.address.toBase58().slice(0, 20) + "...", "👤");
  
  log("Status", "Minting 1,000,000 USDC...", "🔄");
  
  await mintTo(
    connection,
    wallet.payer,
    usdcMint,
    userUsdcAccount.address,
    wallet.publicKey,
    1_000_000 * 10**6
  );
  
  log("Minted", "1,000,000 USDC", "✅");
  
  await sleep(1000);
  

  logSection("STEP 3: Initialize USDC Reserve");
  
  const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
    //@ts-ignore
    [Buffer.from("authority"), lendingMarket.toBuffer()],
    program.programId
  );
  
  const [reserve] = PublicKey.findProgramAddressSync(
    //@ts-ignore
    [Buffer.from("reserve"), lendingMarket.toBuffer(), usdcMint.toBuffer()],
    program.programId
  );
  
  const [liquiditySupply] = PublicKey.findProgramAddressSync(
    //@ts-ignore  
    [Buffer.from("liquidity-supply"), lendingMarket.toBuffer(), usdcMint.toBuffer()],
    program.programId
  );
  
  const [liquidityFeeReceiver] = PublicKey.findProgramAddressSync(
    //@ts-ignore  
    [Buffer.from("fee-receiver"), lendingMarket.toBuffer(), usdcMint.toBuffer()],
    program.programId
  );
  
  const [collateralMint] = PublicKey.findProgramAddressSync(
    //@ts-ignore  
    [Buffer.from("collateral-mint"), lendingMarket.toBuffer(), usdcMint.toBuffer()],
    program.programId
  );
  
  const [collateralSupply] = PublicKey.findProgramAddressSync(
    //@ts-ignore  
    [Buffer.from("collateral-supply"), lendingMarket.toBuffer(), usdcMint.toBuffer()],
    program.programId
  );
  
  const [destinationCollateral] = await PublicKey.findProgramAddress(
    [
      wallet.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      collateralMint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  
  const pythPriceAccount = Keypair.generate().publicKey;
  
  log("Reserve PDA", reserve.toBase58().slice(0, 20) + "...", "📍");
  log("Liquidity Supply", liquiditySupply.toBase58().slice(0, 20) + "...", "💧");
  log("Collateral Mint", collateralMint.toBase58().slice(0, 20) + "...", "🪙");
  log("Pyth Oracle", pythPriceAccount.toBase58().slice(0, 20) + "... (mock)", "🔮");
  
  //@ts-ignore
  const pythPriceFeedId = Buffer.alloc(32);
  const reserveConfig = {
    optimalUtilizationRate: CONFIG.reserves.usdc.optimalUtilizationRate,
    loanToValueRatio: CONFIG.reserves.usdc.loanToValueRatio,
    liquidationBonus: CONFIG.reserves.usdc.liquidationBonus,
    liquidationThreshold: CONFIG.reserves.usdc.liquidationThreshold,
    minBorrowRate: CONFIG.reserves.usdc.minBorrowRate,
    optimalBorrowRate: CONFIG.reserves.usdc.optimalBorrowRate,
    maxBorrowRate: CONFIG.reserves.usdc.maxBorrowRate,
    fees: {
      borrowFeeWad: CONFIG.reserves.usdc.borrowFeeWad,
      flashLoanFeeWad: CONFIG.reserves.usdc.flashLoanFeeWad,
      hostFeePercentage: CONFIG.reserves.usdc.hostFeePercentage,
    },
    pythPriceFeedId: Array.from(pythPriceFeedId),
  };
  
  log("Config", "Optimal Utilization: 90%, LTV: 80%", "⚙️");
  log("Status", "Initializing reserve...", "🔄");
  
  try {
    const tx = await program.methods
      .initReserve(CONFIG.initialLiquidity.usdc, reserveConfig)
      .accounts({
        sourceLiquidity: userUsdcAccount.address,
        liquidityMint: usdcMint,
        lendingMarket: lendingMarket,
        lendingMarketAuthority: lendingMarketAuthority,
        reserve: reserve,
        liquiditySupply: liquiditySupply,
        liquidityFeeReceiver: liquidityFeeReceiver,
        pythPrice: pythPriceAccount,
        collateralMint: collateralMint,
        destinationCollateral: destinationCollateral,
        collateralSupply: collateralSupply,
        owner: wallet.publicKey,
        userTransferAuthority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    log("Transaction", tx.slice(0, 16) + "...", "✅");
    log("Liquidity", "100,000 USDC deposited", "💰");
    log("Status", "Reserve initialized!", "🎉");
  } catch (error: any) {
    log("Error", error.message, "❌");
    console.log("\n⚠️  This is expected if reserve already exists!");
  }
  
  await sleep(2000);
    
  logSection("STEP 4: Start Refresh Keeper Bot");
  
  log("Interval", `${CONFIG.refreshIntervalSeconds} seconds`, "⏱️");
  log("Min Slots", `${CONFIG.minSlotsSinceUpdate} (~${Math.floor(CONFIG.minSlotsSinceUpdate / 2)}s)`, "📊");
  log("Status", "Bot starting...", "🤖");
  
  console.log("\n" + "─".repeat(70));
  console.log("  🚀 KEEPER BOT ACTIVE");
  console.log("  Press Ctrl+C to stop");
  console.log("─".repeat(70) + "\n");
  
  await sleep(1000);
  
  let cycleCount = 0;
  let stats = {
    total: 0,
    success: 0,
    failed: 0,
    startTime: Date.now(),
  };
  
  const runCycle = async () => {
    cycleCount++;
    
    console.log("\n" + "═".repeat(70));
    console.log(`  🔄 CYCLE #${cycleCount} - ${new Date().toLocaleTimeString()}`);
    console.log("═".repeat(70) + "\n");
    
    try {
      const slot = await connection.getSlot();
      log("Current Slot", slot.toString(), "📊");
      
      log("Status", "Fetching reserves...", "🔍");
      
      // @ts-ignore
      const allReserves = await program.account.reserve.all();
      const reserves = allReserves.filter((r: any) =>
        r.account.lendingMarket.equals(lendingMarket)
      );
      
      log("Found", `${reserves.length} reserve(s)`, "📦");
      
      if (reserves.length === 0) {
        log("Warning", "No reserves found!", "⚠️");
        return;
      }
      
      console.log("");
      
      // Check staleness
      const stale = [];
      
      for (const r of reserves) {
        const lastUpdate = Number(r.account.lastUpdateSlot);
        const age = slot - lastUpdate;
        const isStale = age >= CONFIG.minSlotsSinceUpdate;
        const addr = r.publicKey.toBase58();
        const short = `${addr.slice(0, 8)}...${addr.slice(-8)}`;
        
        const icon = isStale ? "🔴" : "🟢";
        const status = isStale ? "STALE" : "Fresh";
        const time = `${age} slots (~${Math.floor(age / 2)}s)`;
        
        log(short, `${status} - ${time}`, icon);
        
        if (isStale) stale.push(r);
      }
      
      if (stale.length === 0) {
        console.log("");
        log("Result", "All reserves are fresh!", "✅");
        return;
      }
      
      console.log("");
      log("Action", `Refreshing ${stale.length} reserve(s)...`, "⚡");
      console.log("");
      
      for (let i = 0; i < stale.length; i++) {
        const r = stale[i];
        const addr = r.publicKey.toBase58();
        const short = `${addr.slice(0, 12)}...${addr.slice(-12)}`;
        
        try {
          console.log(`  [${i + 1}/${stale.length}] 🔄 Refreshing ${short}`);
          console.log(`           Oracle: ${r.account.liquidityOracle.toBase58().slice(0, 12)}...`);
          
          const tx = await program.methods
            .refresh_reserve()
            .accounts({
              reserve: r.publicKey,
              lending_market: r.account.lendingMarket,
              pyth_price: r.account.liquidityOracle,
            })
            .rpc({ skipPreflight: false });
          
          console.log(`  [${i + 1}/${stale.length}] ✅ Success! Tx: ${tx.slice(0, 16)}...`);
          console.log(`           Available: ${r.account.liquidityAvailableAmount.toString()}`);
          console.log(`           Price: ${r.account.liquidityMarketPrice.toString()}`);
          console.log("");
          
          stats.total++;
          stats.success++;
          
        } catch (error: any) {
          console.log(`  [${i + 1}/${stale.length}] ❌ Failed: ${error.message}`);
          console.log("");
          
          stats.total++;
          stats.failed++;
        }
      }
      
      console.log("─".repeat(70));
      console.log(`  📈 Cycle Stats: ${stats.success} success, ${stats.failed} failed (total: ${stats.total})`);
      console.log("─".repeat(70));
      
    } catch (error: any) {
      log("Error", error.message, "❌");
    }
  };
  
  await runCycle();
  
  const interval = setInterval(runCycle, CONFIG.refreshIntervalSeconds * 1000);
  
  //@ts-ignore
  process.on("SIGINT", () => {
    console.log("\n\n");
    console.log("═".repeat(70));
    console.log("  🛑 SHUTTING DOWN");
    console.log("═".repeat(70) + "\n");
    
    clearInterval(interval);
    
    const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
    const minutes = Math.floor(runtime / 60);
    const seconds = runtime % 60;
    
    console.log("  📊 FINAL STATISTICS\n");
    console.log(`  ⏱️  Runtime:         ${minutes}m ${seconds}s`);
    console.log(`  🔄 Total Refreshes: ${stats.total}`);
    console.log(`  ✅ Successful:      ${stats.success}`);
    console.log(`  ❌ Failed:          ${stats.failed}`);
    
    if (stats.total > 0) {
      const rate = ((stats.success / stats.total) * 100).toFixed(1);
      console.log(`  📈 Success Rate:    ${rate}%`);
    }
    
    console.log("\n" + "═".repeat(70));
    console.log("  💡 IMPORTANT INFO");
    console.log("═".repeat(70) + "\n");
    console.log(`  Lending Market PDA: ${lendingMarket.toBase58()}`);
    console.log(`  USDC Mint:          ${usdcMint.toBase58()}`);
    console.log(`  Reservprocesse PDA:        ${reserve.toBase58()}`);
    console.log("\n  Save these addresses! You'll need them later.\n");
    console.log("═".repeat(70) + "\n");
    console.log("  👋 Goodbye!\n");
    //@ts-ignore    
    process.exit(0);
  });
}

main().catch(error => {
  console.error("\n" + "═".repeat(70));
  console.error("  ❌ FATAL ERROR");
  console.error("═".repeat(70) + "\n");
  console.error("  ", error.message);
  console.error("\n" + "═".repeat(70));
  console.error("  💡 TROUBLESHOOTING");
  console.error("═".repeat(70) + "\n");
  console.error("  1. Make sure localnet is running:");
  console.error("     anchor localnet");
  console.error("");
  console.error("  2. Make sure you have dependencies installed:");
  console.error("     npm install @solana/web3.js @coral-xyz/anchor @solana/spl-token");
  console.error("");
  console.error("  3. Check program is deployed:");
  console.error("     anchor deploy");
  console.error("\n" + "═".repeat(70) + "\n");
  //@ts-ignore
  process.exit(1);
});