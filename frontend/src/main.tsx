import { Buffer } from 'buffer';
import process from 'process';

// Polyfill for browser
globalThis.Buffer = Buffer;
globalThis.process = process;

import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { Toaster } from "react-hot-toast";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import InitLendingMarket from "./components/Admin/InitLendingMarket/InitLendingMarket";
import Navbar from "./components/Navbar/navbar";
import AddLiquidity from "./components/Supply/AddLiquidity";
import InitReserve from "./components/Admin/initReserves/initReserves";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";
import MarketOverview from './components/Admin/reservesLists/marketOverview';
import DepositLiquidity from './components/DepositLiquidity/depositLiquidity';

const theme = createTheme({
	palette: {
		primary: {
			main: "#092147",
			light: "#174384",
			contrastText: "#F5F5F5",
		},
		secondary: {
			main: "#F5F5F5",
			contrastText: "#092147",
		},
		error: {
			main: "#DD3636",
		},
		success: {
			main: "#66FF77",
		},
		background: {
			default: "#F5F5F5",
		},
	},
	typography: {
		allVariants: {
			color: "#092147",
			fontFamily: "Poppins",
		},
	},
});

const router = createBrowserRouter([
	{
		path: "/",
		element: <Navbar />,
		children: [
			{
				path: "/market/init",
				element: <InitLendingMarket />,
			},
			{
				path: "/market/reserve/addliquidity",
				element: <AddLiquidity />,
			},
			{
				path: "/market/reserve/init",
				element: <InitReserve />,
			},
			{
				path: "/market/overview",
				element: <MarketOverview />
			},
			{
				path: "/reserve/deposit/liquidity",
				element: <DepositLiquidity />
			}
		],
	},
]);

// LOCALNET RPC ENDPOINT
const RPC_ENDPOINT = "http://127.0.0.1:8899";

function App() {
	const wallets = useMemo(
		() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
		[]
	);

	return (
		<ConnectionProvider endpoint={RPC_ENDPOINT}>
			<WalletProvider wallets={wallets} autoConnect>
				<WalletModalProvider>
					<ThemeProvider theme={theme}>
						<CssBaseline />
						<RouterProvider router={router} />
						<Toaster
							position="bottom-center"
							toastOptions={{
								success: {
									style: {
										background: theme.palette.success.main,
										color: "#000",
									},
								},
								error: {
									style: {
										background: theme.palette.error.main,
										color: "#fff",
									},
								},
							}}
						/>
					</ThemeProvider>
				</WalletModalProvider>
			</WalletProvider>
		</ConnectionProvider>
	);
}

createRoot(document.getElementById("root")!).render(<App />);