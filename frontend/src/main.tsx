import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { Toaster } from "react-hot-toast";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import Navbar from "./components/Navbar/navbar";

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
		element: < Navbar/>,
		// children: [
    //   {
    //   }
		// ],
	},
	{
		// path: "/login",
		// element: <Login />,
	},
]);

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