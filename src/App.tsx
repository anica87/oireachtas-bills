/**
 * App root — wires up all providers.
 */

import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { FavouritesProvider } from "@/context/FavouritesContext";
import { BillsPage } from "@/pages/BillsPage";
import { theme } from "@/styles/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <FavouritesProvider>
          <AppLayout>
            <BillsPage />
          </AppLayout>
        </FavouritesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
