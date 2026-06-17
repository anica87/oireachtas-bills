/**
 * Application MUI theme.
 *
 * Uses a professional colour palette suited to a government legislation tracker.
 * Extends MUI's default theme with custom tokens and typography.
 */

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#1a4b8c", // Deep parliamentary blue
      light: "#4a72b5",
      dark: "#0d2d5a",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#2e7d32", // Oireachtas green
      light: "#60ad5e",
      dark: "#005005",
      contrastText: "#ffffff",
    },
    warning: {
      main: "#f59e0b", // Amber for favourites
    },
    background: {
      default: "#f5f7fa",
      paper: "#ffffff",
    },
    grey: {
      50: "#f8fafc",
    },
  },

  typography: {
    fontFamily: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      "sans-serif",
    ].join(","),

    h5: { fontWeight: 700, letterSpacing: -0.3 },
    h6: { fontWeight: 700 },

    body2: { lineHeight: 1.6 },

    caption: { letterSpacing: 0.4 },
  },

  shape: { borderRadius: 8 },

  components: {
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#f8fafc",
          borderBottom: "2px solid #e2e8f0",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.75rem" },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: "none",
          minHeight: 48,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 12 },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },

    MuiTablePagination: {
      styleOverrides: {
        toolbar: { flexWrap: "wrap" },
      },
    },
  },
});
