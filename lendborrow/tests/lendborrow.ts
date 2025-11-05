import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Lendborrow } from "../target/types/lendborrow";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";


describe("Lending Protocol", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.lendborrow as Program<Lendborrow>;
  const provider = anchor.getProvider();
  const connection = provider.connection;

  let admin: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let lendingMarketPDA: PublicKey;
  let lendingMarketBump: number;

  async function confirmTx(signature: string) {
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...latestBlockhash,
    });
  }

  function createQuoteCurrency(currency: string): number[] {
    const buffer = Buffer.alloc(32);
    buffer.write(currency);
    return Array.from(buffer);
  }

  it("Setup: Create test accounts and fund them", async () => {
    console.log("\n  Setting up test environment...");

    admin = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    console.log("Airdropping SOL...");
    const sig1 = await connection.requestAirdrop(
      admin.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await confirmTx(sig1);

    const sig2 = await connection.requestAirdrop(
      user1.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await confirmTx(sig2);

    const sig3 = await connection.requestAirdrop(
      user2.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await confirmTx(sig3);

    console.log("Airdrops complete");

    [lendingMarketPDA, lendingMarketBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("lending-market"), admin.publicKey.toBuffer()],
        program.programId
      );

    console.log("PDAs derived:");
    console.log("Lending Market:", lendingMarketPDA.toBase58());
    console.log("Bump:", lendingMarketBump);
    console.log("Setup complete!\n");
  });

  describe("Initialize Lending Market", () => {
    it("Should reject invalid quote currency (all zeros)", async () => {
      console.log("\n Testing invalid quote currency...");

      const testOwner = Keypair.generate();
      const airdropSig = await connection.requestAirdrop(
        testOwner.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);

      const [testMarketPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending-market"), testOwner.publicKey.toBuffer()],
        program.programId
      );

      const invalidCurrency = new Array(32).fill(0);

      try {
        await program.methods
          .initLendingMarket(invalidCurrency)
          .accounts({
            owner: testOwner.publicKey,
            //@ts-ignore
            lendingMarket: testMarketPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testOwner])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("InvalidQuoteCurrency") || errMsg.includes("6000"),
          "Should fail with InvalidQuoteCurrency error"
        );
        console.log(" Correctly rejected invalid currency");
      }
    });

    it("Should reject invalid quote currency (invalid UTF-8)", async () => {
      console.log("\n Testing invalid UTF-8 quote currency...");

      const testOwner = Keypair.generate();
      const airdropSig = await connection.requestAirdrop(
        testOwner.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);

      const [testMarketPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending-market"), testOwner.publicKey.toBuffer()],
        program.programId
      );

      const invalidCurrency = new Array(32).fill(0);
      invalidCurrency[0] = 0xff;

      try {
        await program.methods
          .initLendingMarket(invalidCurrency)
          .accounts({
            owner: testOwner.publicKey,
            //@ts-ignore
            lendingMarket: testMarketPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([testOwner])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("InvalidQuoteCurrency") || errMsg.includes("6000"),
          "Should fail with InvalidQuoteCurrency error"
        );
        console.log(" Correctly rejected invalid UTF-8");
      }
    });

    it("Should initialize lending market with USD", async () => {
      console.log("\n Initializing lending market...");

      const quoteCurrency = createQuoteCurrency("USD");

      const tx = await program.methods
        .initLendingMarket(quoteCurrency)
        .accounts({
          owner: admin.publicKey,
          //@ts-ignore
          lendingMarket: lendingMarketPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      await confirmTx(tx);
      console.log(" Tx:", tx);

      const market = await program.account.lendingMarket.fetch(
        lendingMarketPDA
      );

      assert.equal(market.version, 1, "Version should be 1");
      assert.equal(market.bumpSeed, lendingMarketBump, "Bump should match");
      assert.equal(
        market.owner.toBase58(),
        admin.publicKey.toBase58(),
        "Owner should match"
      );
      assert.equal(
        market.tokenProgramId.toBase58(),
        TOKEN_PROGRAM_ID.toBase58(),
        "Token program should match"
      );

      const quoteCurrencyStr = Buffer.from(market.quoteCurrency)
        .toString()
        .replace(/\0/g, "");
      assert.equal(quoteCurrencyStr, "USD", "Quote currency should be USD");

      console.log(" Market initialized successfully");
      console.log("   Version:", market.version);
      console.log("   Owner:", market.owner.toBase58());
      console.log("   Quote:", quoteCurrencyStr);
    });

    it("Should reject duplicate market initialization", async () => {
      console.log("\n Testing duplicate initialization...");

      const quoteCurrency = createQuoteCurrency("EUR");

      try {
        await program.methods
          .initLendingMarket(quoteCurrency)
          .accounts({
            owner: admin.publicKey,
            //@ts-ignore
            lendingMarket: lendingMarketPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("already in use") || errMsg.includes("0x0"),
          "Should fail because market already exists"
        );
        console.log(" Correctly rejected duplicate initialization");
      }
    });

    it("Should initialize market with different currencies", async () => {
      console.log("\n Testing different quote currencies...");

      const currencies = ["EUR", "GBP", "JPY"];

      for (const currency of currencies) {
        const newOwner = Keypair.generate();

        const airdropSig = await connection.requestAirdrop(
          newOwner.publicKey,
          5 * LAMPORTS_PER_SOL
        );
        await confirmTx(airdropSig);

        const [newMarketPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("lending-market"), newOwner.publicKey.toBuffer()],
          program.programId
        );

        const quoteCurrency = createQuoteCurrency(currency);

        const tx = await program.methods
          .initLendingMarket(quoteCurrency)
          .accounts({
            owner: newOwner.publicKey,
            //@ts-ignore
            lendingMarket: newMarketPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([newOwner])
          .rpc();

        await confirmTx(tx);

        const market = await program.account.lendingMarket.fetch(newMarketPDA);
        const fetchedCurrency = Buffer.from(market.quoteCurrency)
          .toString()
          .replace(/\0/g, "");

        assert.equal(fetchedCurrency, currency);
        console.log(` ${currency} market initialized`);
      }
    });
  });

  describe("Security & Edge Cases", () => {
    it("Should reject initialization from non-owner", async () => {
      console.log("\n Testing unauthorized initialization...");

      const unauthorizedUser = Keypair.generate();

      const airdropSig = await connection.requestAirdrop(
        unauthorizedUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);

      const quoteCurrency = createQuoteCurrency("HACK");

      try {
        await program.methods
          .initLendingMarket(quoteCurrency)
          .accounts({
            owner: unauthorizedUser.publicKey,
            //@ts-ignore
            lendingMarket: lendingMarketPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorizedUser])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("ConstraintSeeds") ||
          errMsg.includes("already in use") ||
          errMsg.includes("0x7d1"),
          "Should fail with constraint error"
        );
        console.log(" Correctly rejected unauthorized initialization");
      }
    });

    it("Should handle max length currency string", async () => {
      console.log("\n Testing max length currency...");

      const newOwner = Keypair.generate();
      const airdropSig = await connection.requestAirdrop(
        newOwner.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);

      const [newMarketPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending-market"), newOwner.publicKey.toBuffer()],
        program.programId
      );

      const longCurrency = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
      const quoteCurrency = createQuoteCurrency(longCurrency);

      const tx = await program.methods
        .initLendingMarket(quoteCurrency)
        .accounts({
          owner: newOwner.publicKey,
          //@ts-ignore
          lendingMarket: newMarketPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([newOwner])
        .rpc();

      await confirmTx(tx);

      const market = await program.account.lendingMarket.fetch(newMarketPDA);
      const fetchedCurrency = Buffer.from(market.quoteCurrency)
        .toString()
        .replace(/\0/g, "");

      assert.equal(fetchedCurrency, longCurrency);
      console.log(" Max length currency accepted");
    });

    it("Should initialize with pubkey as quote currency", async () => {
      console.log("\n  Testing pubkey as quote currency...");

      const newOwner = Keypair.generate();
      const airdropSig = await connection.requestAirdrop(
        newOwner.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);

      const [newMarketPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending-market"), newOwner.publicKey.toBuffer()],
        program.programId
      );

      const usdcMint = new PublicKey(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      );
      const quoteCurrency = Array.from(usdcMint.toBuffer());

      const tx = await program.methods
        .initLendingMarket(quoteCurrency)
        .accounts({
          owner: newOwner.publicKey,
          //@ts-ignore
          lendingMarket: newMarketPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([newOwner])
        .rpc();

      await confirmTx(tx);

      const market = await program.account.lendingMarket.fetch(newMarketPDA);
      const fetchedPubkey = new PublicKey(market.quoteCurrency);

      assert.equal(
        fetchedPubkey.toBase58(),
        usdcMint.toBase58(),
        "Quote currency should be USDC mint"
      );
      console.log(" Pubkey quote currency accepted");
    });
  });

  describe("Account State Verification", () => {
    it("Should verify all market fields after initialization", async () => {
      console.log("\n Verifying market state...");

      const market = await program.account.lendingMarket.fetch(
        lendingMarketPDA
      );

      assert.equal(market.version, 1, "Version should be 1");
      console.log(" Version:", market.version);

      assert.equal(
        market.bumpSeed,
        lendingMarketBump,
        "Bump should match derived bump"
      );
      console.log(" Bump seed:", market.bumpSeed);

      assert.equal(
        market.owner.toBase58(),
        admin.publicKey.toBase58(),
        "Owner should be admin"
      );
      console.log(" Owner:", market.owner.toBase58());

      assert.equal(
        market.tokenProgramId.toBase58(),
        TOKEN_PROGRAM_ID.toBase58(),
        "Token program should be SPL Token"
      );
      console.log(" Token Program:", market.tokenProgramId.toBase58());

      const quoteCurrencyStr = Buffer.from(market.quoteCurrency)
        .toString()
        .replace(/\0/g, "");
      assert.equal(quoteCurrencyStr, "USD", "Quote currency should be USD");
      console.log(" Quote Currency:", quoteCurrencyStr);

      console.log(" All fields verified correctly");
    });

    it("Should verify account size", async () => {
      console.log("\n Verifying account size...");

      const accountInfo = await connection.getAccountInfo(lendingMarketPDA);

      assert.isNotNull(accountInfo, "Account should exist");

      const expectedSize =
        8 +
        32 +
        1 +
        1 +
        32 +
        32;

      assert.equal(
        accountInfo!.data.length,
        expectedSize,
        `Account size should be ${expectedSize} bytes`
      );

      console.log(" Account size:", accountInfo!.data.length, "bytes");
      console.log(" Expected:", expectedSize, "bytes");
    });

    it("Should verify account is rent exempt", async () => {
      console.log("\n Verifying rent exemption...");

      const accountInfo = await connection.getAccountInfo(lendingMarketPDA);
      const minimumBalance = await connection.getMinimumBalanceForRentExemption(
        accountInfo!.data.length
      );

      assert.isTrue(
        accountInfo!.lamports >= minimumBalance,
        "Account should be rent exempt"
      );

      console.log(" Account lamports:", accountInfo!.lamports);
      console.log(" Minimum required:", minimumBalance);
      console.log(
        " Rent exempt:",
        accountInfo!.lamports >= minimumBalance ? "YES" : "NO"
      );
    });

    it("Should verify account ownership", async () => {
      console.log("\n  Verifying account ownership...");

      const accountInfo = await connection.getAccountInfo(lendingMarketPDA);

      assert.equal(
        accountInfo!.owner.toBase58(),
        program.programId.toBase58(),
        "Account should be owned by program"
      );

      console.log(" Account owner:", accountInfo!.owner.toBase58());
      console.log(" Program ID:", program.programId.toBase58());
    });
  });

  describe("Performance Tests", () => {
    it("Should initialize multiple markets quickly", async () => {
      console.log("\n Performance test: Multiple initializations...");

      const startTime = Date.now();
      const count = 5;

      for (let i = 0; i < count; i++) {
        const newOwner = Keypair.generate();

        const airdropSig = await connection.requestAirdrop(
          newOwner.publicKey,
          2 * LAMPORTS_PER_SOL
        );
        await confirmTx(airdropSig);

        const [newMarketPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("lending-market"), newOwner.publicKey.toBuffer()],
          program.programId
        );

        const quoteCurrency = createQuoteCurrency(`CURR${i}`);

        const tx = await program.methods
          .initLendingMarket(quoteCurrency)
          .accounts({
            owner: newOwner.publicKey,
            //@ts-ignore
            lendingMarket: newMarketPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([newOwner])
          .rpc();

        await confirmTx(tx);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(` Initialized ${count} markets in ${duration}ms`);
      console.log(
        ` Average: ${(duration / count).toFixed(2)}ms per market`
      );
    });
  });

  describe("Set Lending Market Owner", () => {
    let newOwner: Keypair;

    it("Should set new lending market owner", async () => {
      console.log("\n Testing ownership transfer...");

      newOwner = Keypair.generate();

      const airdropSig = await connection.requestAirdrop(
        newOwner.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);

      console.log("Current owner:", admin.publicKey.toBase58());
      console.log("New owner:", newOwner.publicKey.toBase58());

      const tx = await program.methods
        .setLendingMarketOwner(newOwner.publicKey)
        .accounts({
          lendingMarket: lendingMarketPDA,
          //@ts-ignore
          owner: admin.publicKey,
        })
        .signers([admin])
        .rpc();

      await confirmTx(tx);
      console.log(" Tx:", tx);

      const market = await program.account.lendingMarket.fetch(lendingMarketPDA);

      assert.equal(
        market.owner.toBase58(),
        newOwner.publicKey.toBase58(),
        "Owner should be updated"
      );

      console.log("   Owner successfully changed");
      console.log("   Old owner:", admin.publicKey.toBase58());
      console.log("   New owner:", market.owner.toBase58());
    });

    it("Should reject transfer from non-owner", async () => {
      console.log("\n Testing unauthorized transfer...");

      const unauthorizedUser = Keypair.generate();
      const airdropSig = await connection.requestAirdrop(
        unauthorizedUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);

      const anotherOwner = Keypair.generate();

      try {
        await program.methods
          .setLendingMarketOwner(anotherOwner.publicKey)
          .accounts({
            lendingMarket: lendingMarketPDA,
            //@ts-ignore
            owner: unauthorizedUser.publicKey,
          })
          .signers([unauthorizedUser])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("InvalidOwner") || errMsg.includes("6001"),
          "Should fail with InvalidOwner error"
        );
        console.log(" Correctly rejected unauthorized transfer");
      }
    });

    it("Should reject setting same owner", async () => {
      console.log("\n Testing same owner rejection...");

      try {
        await program.methods
          .setLendingMarketOwner(newOwner.publicKey)
          .accounts({
            lendingMarket: lendingMarketPDA,
            //@ts-ignore
            owner: newOwner.publicKey,
          })
          .signers([newOwner])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("SameOwner") || errMsg.includes("6004"),
          "Should fail with SameOwner error"
        );
        console.log(" Correctly rejected same owner");
      }
    });

    it("Should reject default pubkey as new owner", async () => {
      console.log("\n Testing default pubkey rejection...");

      const defaultPubkey = PublicKey.default;

      try {
        await program.methods
          .setLendingMarketOwner(defaultPubkey)
          .accounts({
            lendingMarket: lendingMarketPDA,
            //@ts-ignore
            owner: newOwner.publicKey,
          })
          .signers([newOwner])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("InvalidNewOwner") || errMsg.includes("6005"),
          "Should fail with InvalidNewOwner error"
        );
        console.log(" Correctly rejected default pubkey");
      }
    });

    it("Should allow multiple ownership transfers", async () => {
      console.log("\n Testing multiple transfers...");

      const owner2 = Keypair.generate();
      const owner3 = Keypair.generate();

      const sig2 = await connection.requestAirdrop(
        owner2.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(sig2);

      const sig3 = await connection.requestAirdrop(
        owner3.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await confirmTx(sig3);

      const tx1 = await program.methods
        .setLendingMarketOwner(owner2.publicKey)
        .accounts({
          lendingMarket: lendingMarketPDA,
          //@ts-ignore
          owner: newOwner.publicKey,
        })
        .signers([newOwner])
        .rpc();
      await confirmTx(tx1);

      let market = await program.account.lendingMarket.fetch(lendingMarketPDA);
      assert.equal(market.owner.toBase58(), owner2.publicKey.toBase58());
      console.log(" Transfer 1: newOwner -> owner2");

      const tx2 = await program.methods
        .setLendingMarketOwner(owner3.publicKey)
        .accounts({
          lendingMarket: lendingMarketPDA,
          //@ts-ignore
          owner: owner2.publicKey,
        })
        .signers([owner2])
        .rpc();
      await confirmTx(tx2);

      market = await program.account.lendingMarket.fetch(lendingMarketPDA);
      assert.equal(market.owner.toBase58(), owner3.publicKey.toBase58());
      console.log(" Transfer 2: owner2 -> owner3");

      console.log(" Multiple transfers successful");
    });

    it("Should verify old owner loses access", async () => {
      console.log("\n Testing old owner loses access...");

      const newUser = Keypair.generate();

      try {
        await program.methods
          .setLendingMarketOwner(newUser.publicKey)
          .accounts({
            lendingMarket: lendingMarketPDA,
            //@ts-ignore
            owner: admin.publicKey,
          })
          .signers([admin])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        const errMsg = err.toString();
        assert.isTrue(
          errMsg.includes("InvalidOwner") || errMsg.includes("6001"),
          "Should fail because admin is no longer owner"
        );
        console.log(" Old owner correctly lost access");
      }
    });
  });

  describe("Init Reserve", () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.lendborrow as Program<Lendborrow>;
    const provider = anchor.getProvider();
    const connection = provider.connection;

    let admin: Keypair;
    let usdcMint: PublicKey;
    let adminUsdcAccount: PublicKey;
    let lendingMarketPDA: PublicKey;
    let lendingMarketAuthorityPDA: PublicKey;
    let reservePDA: PublicKey;
    let liquiditySupplyPDA: PublicKey;
    let liquidityFeeReceiverPDA: PublicKey;
    let collateralMintPDA: PublicKey;
    let collateralSupplyPDA: PublicKey;
    let pythProductMock: Keypair;
    let pythPriceMock: Keypair;

    async function confirmTx(signature: string) {
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      });
    }

    function createQuoteCurrency(currency: string): number[] {
      const buffer = Buffer.alloc(32);
      buffer.write(currency);
      return Array.from(buffer);
    }

    before(async () => {
      console.log("\n Setting up test environment...");

      admin = Keypair.generate();

      console.log("💰 Airdropping SOL...");
      const sig1 = await connection.requestAirdrop(
        admin.publicKey,
        10 * LAMPORTS_PER_SOL
      );
      await confirmTx(sig1);

      console.log(" Airdrops complete");

      console.log(" Creating token mints...");
      usdcMint = await createMint(
        connection,
        admin,
        admin.publicKey,
        null,
        6,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID
      );

      console.log("USDC Mint:", usdcMint.toBase58());

      const adminUsdcAcc = await getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        usdcMint,
        admin.publicKey,
        false,
        undefined,
        undefined,
        TOKEN_PROGRAM_ID
      );
      adminUsdcAccount = adminUsdcAcc.address;

      await mintTo(
        connection,
        admin,
        usdcMint,
        adminUsdcAccount,
        admin,
        100_000_000_000,
        [],
        undefined,
        TOKEN_PROGRAM_ID
      );

      console.log(" Tokens minted");

      console.log(" Initializing lending market...");
      [lendingMarketPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending-market"), admin.publicKey.toBuffer()],
        program.programId
      );

      const quoteCurrency = createQuoteCurrency("USD");

      await program.methods
        .initLendingMarket(quoteCurrency)
        .accounts({
          owner: admin.publicKey,
          //@ts-ignore
          lendingMarket: lendingMarketPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      console.log(" Lending market initialized");

      [lendingMarketAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("authority"), lendingMarketPDA.toBuffer()],
        program.programId
      );

      pythProductMock = Keypair.generate();
      pythPriceMock = Keypair.generate();

      [reservePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("reserve"), lendingMarketPDA.toBuffer(), usdcMint.toBuffer()],
        program.programId
      );

      [liquiditySupplyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity-supply"), lendingMarketPDA.toBuffer(), usdcMint.toBuffer()],
        program.programId
      );

      [liquidityFeeReceiverPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee-receiver"), lendingMarketPDA.toBuffer(), usdcMint.toBuffer()],
        program.programId
      );

      [collateralMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("collateral-mint"), lendingMarketPDA.toBuffer(), usdcMint.toBuffer()],
        program.programId
      );

      [collateralSupplyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("collateral-supply"), lendingMarketPDA.toBuffer(), usdcMint.toBuffer()],
        program.programId
      );

      console.log(" Setup complete!\n");
    });

    it("Should initialize USDC reserve successfully", async () => {
      console.log("\n Initializing USDC reserve...");

      const liquidityAmount = new BN("1000000000"); 

      const config = {
        optimalUtilizationRate: 80,     
        loanToValueRatio: 50,             
        liquidationBonus: 5,             
        liquidationThreshold: 55,         
        minBorrowRate: 0,                
        optimalBorrowRate: 4,            
        maxBorrowRate: 30,                
        fees: {
          borrowFeeWad: new BN("10000000000000000"),      
          flashLoanFeeWad: new BN("9000000000000000"),  
          hostFeePercentage: 20,                          
        },
      };

      console.log(" Sending config:", config);

      const adminCollateralAddress = await anchor.utils.token.associatedAddress({
        mint: collateralMintPDA,
        owner: admin.publicKey,
      });

      console.log(" Reserve PDAs:");
      console.log("   Reserve:", reservePDA.toBase58());
      console.log("   Admin Collateral ATA:", adminCollateralAddress.toBase58());

      const adminUsdcBefore = await getAccount(
        connection,
        adminUsdcAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );
      console.log(" Admin USDC before:", Number(adminUsdcBefore.amount) / 1e6);

      const tx = await program.methods
        .initReserve(liquidityAmount, config)
        .accounts({
          sourceLiquidity: adminUsdcAccount,
          //@ts-ignore
          destinationCollateral: adminCollateralAddress,
          reserve: reservePDA,
          liquidityMint: usdcMint,
          liquiditySupply: liquiditySupplyPDA,
          liquidityFeeReceiver: liquidityFeeReceiverPDA,
          pythProduct: pythProductMock.publicKey,
          pythPrice: pythPriceMock.publicKey,
          collateralMint: collateralMintPDA,
          collateralSupply: collateralSupplyPDA,
          lendingMarket: lendingMarketPDA,
          lendingMarketAuthority: lendingMarketAuthorityPDA,
          owner: admin.publicKey,
          userTransferAuthority: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([admin])
        .rpc();

      await confirmTx(tx);
      console.log(" Transaction confirmed:", tx);

      const reserve = await program.account.reserve.fetch(reservePDA);
      console.log("\n Reserve initialized!");
      console.log("   Version:", reserve.version);
      console.log("   LTV:", reserve.config.loanToValueRatio);
      console.log("   Liquidation threshold:", reserve.config.liquidationThreshold);

      console.log("   Available liquidity:", Number(reserve.liquidityAvailableAmount) / 1e6, "USDC");

      const liquiditySupply = await getAccount(
        connection,
        liquiditySupplyPDA,
        undefined,
        TOKEN_PROGRAM_ID
      );
      console.log("   Liquidity in reserve:", Number(liquiditySupply.amount) / 1e6, "USDC");

      const adminCollateral = await getAccount(
        connection,
        adminCollateralAddress,
        undefined,
        TOKEN_PROGRAM_ID
      );
      console.log("   Collateral minted:", Number(adminCollateral.amount) / 1e6, "lpUSDC");

      assert.equal(reserve.version, 1, "Version should be 1");
      assert.equal(reserve.config.loanToValueRatio, 50, "LTV should be 50");
      assert.equal(reserve.config.liquidationThreshold, 55, "Threshold should be 55");

      assert.equal(
        reserve.liquidityAvailableAmount.toString(),
        liquidityAmount.toString(),
        "Available amount should match"
      );

      assert.equal(
        Number(liquiditySupply.amount),
        liquidityAmount.toNumber(),
        "Liquidity supply should match"
      );

      assert.equal(
        Number(adminCollateral.amount),
        liquidityAmount.toNumber(),
        "Collateral minted should match"
      );

      console.log("\n All checks passed!");
    });
  });
});