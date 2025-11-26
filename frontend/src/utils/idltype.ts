/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/lendborrow.json`.
 */
export type Lendborrow = {
  "address": "9usNowCmVFT37UkUoseUDhpcZqkedVYoFi4KG9aAcWsk",
  "metadata": {
    "name": "lendborrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "borrowObligationLiquidity",
      "discriminator": [
        121,
        127,
        18,
        204,
        73,
        245,
        225,
        65
      ],
      "accounts": [
        {
          "name": "sourceLiquidity",
          "writable": true
        },
        {
          "name": "destinationLiquidity",
          "writable": true
        },
        {
          "name": "borrowReserve",
          "writable": true
        },
        {
          "name": "borrowReserveLiquidityFeeReceiver",
          "writable": true
        },
        {
          "name": "obligation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  108,
                  105,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "obligationOwner"
              }
            ]
          }
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              }
            ]
          }
        },
        {
          "name": "obligationOwner",
          "signer": true
        },
        {
          "name": "hostFeeReceiver",
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositObligationCollateral",
      "discriminator": [
        108,
        209,
        4,
        72,
        21,
        22,
        118,
        133
      ],
      "accounts": [
        {
          "name": "sourceCollateral",
          "writable": true
        },
        {
          "name": "destinationCollateral",
          "writable": true
        },
        {
          "name": "reserve"
        },
        {
          "name": "obligation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  108,
                  105,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "obligationOwner"
              }
            ]
          }
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              }
            ]
          }
        },
        {
          "name": "obligationOwner",
          "writable": true,
          "signer": true
        },
        {
          "name": "userTransferAuthority",
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initLendingMarket",
      "discriminator": [
        34,
        162,
        116,
        14,
        101,
        137,
        94,
        239
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "lendingMarket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "quoteCurrency",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "initObligation",
      "discriminator": [
        251,
        10,
        231,
        76,
        27,
        11,
        159,
        96
      ],
      "accounts": [
        {
          "name": "obligation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  108,
                  105,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initReserve",
      "discriminator": [
        138,
        245,
        71,
        225,
        153,
        4,
        3,
        43
      ],
      "accounts": [
        {
          "name": "sourceLiquidity",
          "writable": true
        },
        {
          "name": "liquidityMint"
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              }
            ]
          }
        },
        {
          "name": "reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "liquidityMint"
              }
            ]
          }
        },
        {
          "name": "liquiditySupply",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  113,
                  117,
                  105,
                  100,
                  105,
                  116,
                  121,
                  45,
                  115,
                  117,
                  112,
                  112,
                  108,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "liquidityMint"
              }
            ]
          }
        },
        {
          "name": "liquidityFeeReceiver",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  118,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "liquidityMint"
              }
            ]
          }
        },
        {
          "name": "pythPrice"
        },
        {
          "name": "collateralMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  45,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "liquidityMint"
              }
            ]
          }
        },
        {
          "name": "destinationCollateral",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "collateralMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "collateralSupply",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  45,
                  115,
                  117,
                  112,
                  112,
                  108,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "liquidityMint"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "lendingMarket"
          ]
        },
        {
          "name": "userTransferAuthority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        },
        {
          "name": "config",
          "type": {
            "defined": {
              "name": "reserveConfig"
            }
          }
        }
      ]
    },
    {
      "name": "liquidateObligation",
      "discriminator": [
        174,
        105,
        88,
        231,
        44,
        70,
        232,
        134
      ],
      "accounts": [
        {
          "name": "sourceLiquidity",
          "writable": true
        },
        {
          "name": "destinationCollateral",
          "writable": true
        },
        {
          "name": "repayReserve",
          "writable": true
        },
        {
          "name": "destinationLiquidity",
          "writable": true
        },
        {
          "name": "withdrawReserve"
        },
        {
          "name": "withdrawReserveCollateralSupply",
          "writable": true
        },
        {
          "name": "obligation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  108,
                  105,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "obligation.owner",
                "account": "obligation"
              }
            ]
          }
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              }
            ]
          }
        },
        {
          "name": "userTransferAuthority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "refreshObligation",
      "discriminator": [
        33,
        132,
        147,
        228,
        151,
        192,
        72,
        89
      ],
      "accounts": [
        {
          "name": "obligation",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "refreshReserve",
      "discriminator": [
        2,
        218,
        138,
        235,
        79,
        201,
        25,
        102
      ],
      "accounts": [
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "lendingMarket",
          "relations": [
            "reserve"
          ]
        },
        {
          "name": "pythPrice"
        }
      ],
      "args": []
    },
    {
      "name": "repayObligationLiquidity",
      "discriminator": [
        145,
        178,
        13,
        225,
        76,
        240,
        147,
        72
      ],
      "accounts": [
        {
          "name": "sourceLiquidity",
          "writable": true
        },
        {
          "name": "destinationLiquidity",
          "writable": true
        },
        {
          "name": "repayReserve",
          "writable": true
        },
        {
          "name": "obligation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  108,
                  105,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "obligationOwner"
              }
            ]
          }
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "obligationOwner",
          "signer": true
        },
        {
          "name": "userTransferAuthority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setLendingMarketOwner",
      "discriminator": [
        195,
        167,
        10,
        253,
        167,
        211,
        14,
        143
      ],
      "accounts": [
        {
          "name": "lendingMarket",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "lendingMarket"
          ]
        }
      ],
      "args": [
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdrawObligationCollateral",
      "discriminator": [
        37,
        116,
        205,
        103,
        243,
        192,
        92,
        198
      ],
      "accounts": [
        {
          "name": "sourceCollateral",
          "writable": true
        },
        {
          "name": "destinationCollateral",
          "writable": true
        },
        {
          "name": "withdrawReserve"
        },
        {
          "name": "obligation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  108,
                  105,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              },
              {
                "kind": "account",
                "path": "obligationOwner"
              }
            ]
          }
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              }
            ]
          }
        },
        {
          "name": "obligationOwner",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "lendingMarket",
      "discriminator": [
        246,
        114,
        50,
        98,
        72,
        157,
        28,
        120
      ]
    },
    {
      "name": "obligation",
      "discriminator": [
        168,
        206,
        141,
        106,
        88,
        76,
        172,
        167
      ]
    },
    {
      "name": "reserve",
      "discriminator": [
        43,
        242,
        204,
        202,
        26,
        247,
        59,
        127
      ]
    }
  ],
  "events": [
    {
      "name": "collateralDeposited",
      "discriminator": [
        244,
        62,
        77,
        11,
        135,
        112,
        61,
        96
      ]
    },
    {
      "name": "collateralWithdrawn",
      "discriminator": [
        51,
        224,
        133,
        106,
        74,
        173,
        72,
        82
      ]
    },
    {
      "name": "lendingMarketInitialized",
      "discriminator": [
        244,
        242,
        249,
        138,
        156,
        35,
        123,
        108
      ]
    },
    {
      "name": "lendingMarketOwnerChanged",
      "discriminator": [
        119,
        192,
        191,
        128,
        231,
        42,
        214,
        67
      ]
    },
    {
      "name": "liquidityBorrowed",
      "discriminator": [
        244,
        147,
        180,
        164,
        100,
        50,
        111,
        27
      ]
    },
    {
      "name": "liquidityRepaid",
      "discriminator": [
        36,
        45,
        9,
        93,
        199,
        37,
        215,
        82
      ]
    },
    {
      "name": "obligationInitialized",
      "discriminator": [
        243,
        123,
        232,
        176,
        68,
        64,
        78,
        146
      ]
    },
    {
      "name": "obligationLiquidated",
      "discriminator": [
        164,
        115,
        79,
        147,
        204,
        253,
        177,
        124
      ]
    },
    {
      "name": "obligationRefreshed",
      "discriminator": [
        242,
        192,
        134,
        83,
        14,
        54,
        46,
        12
      ]
    },
    {
      "name": "reserveInitialized",
      "discriminator": [
        22,
        27,
        136,
        173,
        244,
        120,
        20,
        49
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidQuoteCurrency",
      "msg": "Invalid quote currency format. Must be valid UTF-8 string or non-zero pubkey"
    },
    {
      "code": 6001,
      "name": "invalidOwner",
      "msg": "Invalid owner. Only the market owner can perform this action"
    },
    {
      "code": 6002,
      "name": "marketAlreadyInitialized",
      "msg": "Market already initialized"
    },
    {
      "code": 6003,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6004,
      "name": "sameOwner",
      "msg": "New owner must be different from current owner"
    },
    {
      "code": 6005,
      "name": "invalidNewOwner",
      "msg": "Invalid new owner. Cannot be default pubkey"
    },
    {
      "code": 6006,
      "name": "invalidReserveConfig",
      "msg": "Invalid reserve configuration"
    },
    {
      "code": 6007,
      "name": "invalidLiquidityAmount",
      "msg": "Invalid liquidity amount"
    },
    {
      "code": 6008,
      "name": "invalidLendingMarket",
      "msg": "Invalid lending market"
    },
    {
      "code": 6009,
      "name": "invalidLiquidityMint",
      "msg": "Invalid liquidity mint"
    },
    {
      "code": 6010,
      "name": "invalidLiquiditySupply",
      "msg": "Invalid liquidity supply"
    },
    {
      "code": 6011,
      "name": "invalidCollateralMint",
      "msg": "Invalid collateral mint"
    },
    {
      "code": 6012,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6013,
      "name": "reserveStale",
      "msg": "Reserve is stale and must be refreshed"
    },
    {
      "code": 6014,
      "name": "insufficientLiquidity",
      "msg": "Insufficient liquidity"
    },
    {
      "code": 6015,
      "name": "obligationReserveLimit",
      "msg": "Obligation cannot have more than 10 deposits and borrows combined"
    },
    {
      "code": 6016,
      "name": "obligationDepositsEmpty",
      "msg": "Obligation has no deposits"
    },
    {
      "code": 6017,
      "name": "obligationBorrowsEmpty",
      "msg": "Obligation has no borrows"
    },
    {
      "code": 6018,
      "name": "obligationDepositsZero",
      "msg": "Obligation deposits have zero value"
    },
    {
      "code": 6019,
      "name": "obligationBorrowsZero",
      "msg": "Obligation borrows have zero value"
    },
    {
      "code": 6020,
      "name": "obligationHealthy",
      "msg": "Obligation is healthy and cannot be liquidated"
    },
    {
      "code": 6021,
      "name": "obligationStale",
      "msg": "Obligation is stale and must be refreshed"
    },
    {
      "code": 6022,
      "name": "invalidObligationOwner",
      "msg": "Invalid obligation owner"
    },
    {
      "code": 6023,
      "name": "invalidObligationCollateral",
      "msg": "Invalid obligation collateral"
    },
    {
      "code": 6024,
      "name": "invalidObligationLiquidity",
      "msg": "Invalid obligation liquidity"
    },
    {
      "code": 6025,
      "name": "invalidObligationIndex",
      "msg": "Invalid obligation index"
    },
    {
      "code": 6026,
      "name": "invalidObligationData",
      "msg": "Invalid obligation data"
    },
    {
      "code": 6027,
      "name": "invalidReserveCount",
      "msg": "Invalid reserve count"
    },
    {
      "code": 6028,
      "name": "noReservesToRefresh",
      "msg": "No reserves to refresh"
    },
    {
      "code": 6029,
      "name": "invalidReserveForObligation",
      "msg": "Invalid reserve for obligation"
    },
    {
      "code": 6030,
      "name": "invalidMarket",
      "msg": "Invalid market"
    },
    {
      "code": 6031,
      "name": "invalidCollateralSupply",
      "msg": "Invalid collateral supply"
    },
    {
      "code": 6032,
      "name": "withdrawTooLarge",
      "msg": "Withdraw amount is too large"
    },
    {
      "code": 6033,
      "name": "withdrawTooSmall",
      "msg": "Withdraw amount is too small"
    },
    {
      "code": 6034,
      "name": "obligationCollateralEmpty",
      "msg": "Obligation collateral is empty"
    },
    {
      "code": 6035,
      "name": "reserveCollateralDisabled",
      "msg": "Reserve collateral is disabled"
    },
    {
      "code": 6036,
      "name": "negativeInterestRate",
      "msg": "Negative interest rate"
    },
    {
      "code": 6037,
      "name": "obligationUnhealthy",
      "msg": "Obligation is unhealthy"
    },
    {
      "code": 6038,
      "name": "liquidationTooSmall",
      "msg": "Liquidation amount is too small"
    },
    {
      "code": 6039,
      "name": "liquidationTooLarge",
      "msg": "Liquidation amount is too large"
    },
    {
      "code": 6040,
      "name": "cannotLiquidateOwnObligation",
      "msg": "Cannot liquidate own obligation"
    },
    {
      "code": 6041,
      "name": "marketNotInitialized",
      "msg": "Market not initialized"
    },
    {
      "code": 6042,
      "name": "invalidOracleConfig",
      "msg": "Invalid oracle configuration"
    },
    {
      "code": 6043,
      "name": "oraclePriceStale",
      "msg": "Oracle price is stale"
    },
    {
      "code": 6044,
      "name": "oraclePriceInvalid",
      "msg": "Oracle price is invalid or negative"
    },
    {
      "code": 6045,
      "name": "oraclePriceConfidenceTooWide",
      "msg": "Oracle price confidence interval too wide"
    },
    {
      "code": 6046,
      "name": "invalidAccountInput",
      "msg": "Invalid account input"
    },
    {
      "code": 6047,
      "name": "invalidMint",
      "msg": "Invalid mint"
    },
    {
      "code": 6048,
      "name": "insufficientCollateral",
      "msg": "Insufficient collateral to borrow the requested amount"
    },
    {
      "code": 6049,
      "name": "borrowExceedsLiquidity",
      "msg": "Borrow amount exceeds reserve liquidity"
    },
    {
      "code": 6050,
      "name": "borrowExceedsUserLimit",
      "msg": "Borrow amount exceeds user borrow limit"
    },
    {
      "code": 6051,
      "name": "repayExceedsUserBalance",
      "msg": "Repay amount exceeds user borrow balance"
    },
    {
      "code": 6052,
      "name": "borrowTooLarge",
      "msg": "Borrow amount is too large"
    },
    {
      "code": 6053,
      "name": "borrowTooSmall",
      "msg": "Borrow amount is too small"
    },
    {
      "code": 6054,
      "name": "invalidFeeReceiver",
      "msg": "Invalid fee receiver"
    },
    {
      "code": 6055,
      "name": "invalidDestinationAccount",
      "msg": "Invalid destination account"
    },
    {
      "code": 6056,
      "name": "repayTooSmall",
      "msg": "Repay amount is too small"
    },
    {
      "code": 6057,
      "name": "obligationLiquidityNotFound",
      "msg": "Obligation liquidity not found"
    },
    {
      "code": 6058,
      "name": "obligationLiquidityEmpty",
      "msg": "Obligation liquidity is empty"
    },
    {
      "code": 6059,
      "name": "invalidMarketAuthority",
      "msg": "Invalid market authority"
    }
  ],
  "types": [
    {
      "name": "collateralDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "obligation",
            "type": "pubkey"
          },
          {
            "name": "reserve",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "collateralWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "obligation",
            "type": "pubkey"
          },
          {
            "name": "reserve",
            "type": "pubkey"
          },
          {
            "name": "collateralAmount",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "lendingMarket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bumpSeed",
            "type": "u8"
          },
          {
            "name": "quoteCurrency",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tokenProgramId",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "lendingMarketInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "quoteCurrency",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lendingMarketOwnerChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "oldOwner",
            "type": "pubkey"
          },
          {
            "name": "newOwner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "liquidityBorrowed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "obligation",
            "type": "pubkey"
          },
          {
            "name": "reserve",
            "type": "pubkey"
          },
          {
            "name": "liquidityAmount",
            "type": "u64"
          },
          {
            "name": "borrowAmountWads",
            "type": "u128"
          },
          {
            "name": "receiveAmount",
            "type": "u64"
          },
          {
            "name": "borrowFee",
            "type": "u64"
          },
          {
            "name": "hostFee",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidityRepaid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "obligation",
            "type": "pubkey"
          },
          {
            "name": "reserve",
            "type": "pubkey"
          },
          {
            "name": "liquidityAmount",
            "type": "u64"
          },
          {
            "name": "settleAmountWads",
            "type": "u128"
          },
          {
            "name": "repayAmount",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "obligation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "lastUpdateSlot",
            "type": "u64"
          },
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "depositedValue",
            "type": "u128"
          },
          {
            "name": "borrowedValue",
            "type": "u128"
          },
          {
            "name": "allowedBorrowValue",
            "type": "u128"
          },
          {
            "name": "unhealthyBorrowValue",
            "type": "u128"
          },
          {
            "name": "depositsLen",
            "type": "u8"
          },
          {
            "name": "borrowsLen",
            "type": "u8"
          },
          {
            "name": "dataFlat",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "obligationInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "obligation",
            "type": "pubkey"
          },
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "obligationLiquidated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "obligation",
            "type": "pubkey"
          },
          {
            "name": "repayReserve",
            "type": "pubkey"
          },
          {
            "name": "withdrawReserve",
            "type": "pubkey"
          },
          {
            "name": "liquidityAmount",
            "type": "u64"
          },
          {
            "name": "repayAmount",
            "type": "u64"
          },
          {
            "name": "settleAmountWads",
            "type": "u128"
          },
          {
            "name": "withdrawCollateral",
            "type": "u64"
          },
          {
            "name": "liquidator",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "obligationRefreshed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "obligation",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "depositedValue",
            "type": "u128"
          },
          {
            "name": "borrowedValue",
            "type": "u128"
          },
          {
            "name": "allowedBorrowValue",
            "type": "u128"
          },
          {
            "name": "unhealthyBorrowValue",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "reserve",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "lastUpdateSlot",
            "type": "u64"
          },
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "liquidityMint",
            "type": "pubkey"
          },
          {
            "name": "liquidityMintDecimals",
            "type": "u8"
          },
          {
            "name": "liquiditySupply",
            "type": "pubkey"
          },
          {
            "name": "liquidityFeeReceiver",
            "type": "pubkey"
          },
          {
            "name": "liquidityOracle",
            "type": "pubkey"
          },
          {
            "name": "liquidityAvailableAmount",
            "type": "u64"
          },
          {
            "name": "liquidityBorrowedAmountWads",
            "type": "u128"
          },
          {
            "name": "liquidityCumulativeBorrowRateWads",
            "type": "u128"
          },
          {
            "name": "liquidityMarketPrice",
            "type": "u128"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "collateralSupply",
            "type": "pubkey"
          },
          {
            "name": "collateralMintTotalSupply",
            "type": "u64"
          },
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "reserveConfig"
              }
            }
          }
        ]
      }
    },
    {
      "name": "reserveConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "optimalUtilizationRate",
            "type": "u8"
          },
          {
            "name": "loanToValueRatio",
            "type": "u8"
          },
          {
            "name": "liquidationBonus",
            "type": "u8"
          },
          {
            "name": "liquidationThreshold",
            "type": "u8"
          },
          {
            "name": "minBorrowRate",
            "type": "u8"
          },
          {
            "name": "optimalBorrowRate",
            "type": "u8"
          },
          {
            "name": "maxBorrowRate",
            "type": "u8"
          },
          {
            "name": "fees",
            "type": {
              "defined": {
                "name": "reserveFees"
              }
            }
          },
          {
            "name": "pythPriceFeedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "reserveFees",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "borrowFeeWad",
            "type": "u64"
          },
          {
            "name": "flashLoanFeeWad",
            "type": "u64"
          },
          {
            "name": "hostFeePercentage",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "reserveInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reserve",
            "type": "pubkey"
          },
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "liquidityMint",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "liquidityAmount",
            "type": "u64"
          },
          {
            "name": "initialPrice",
            "type": "u128"
          },
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "reserveConfig"
              }
            }
          }
        ]
      }
    }
  ]
};
