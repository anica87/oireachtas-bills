/**
 * AppLayout — root layout with skip-to-content link,
 * header, and main content area.
 *
 * Implements:
 *  - Skip navigation link for keyboard/screen reader users
 *  - ARIA landmark regions (banner, main, navigation)
 *  - Responsive design
 */

import GavelIcon from "@mui/icons-material/Gavel";
import { AppBar, Box, Container, Link, Toolbar, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Skip to main content — accessibility */}
      <Link
        href="#main-content"
        sx={{
          position: "absolute",
          top: -100,
          left: 8,
          zIndex: 9999,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          px: 2,
          py: 1,
          borderRadius: 1,
          fontWeight: 600,
          "&:focus": { top: 8 },
          transition: "top 0.2s",
          textDecoration: "none",
        }}
      >
        Skip to main content
      </Link>

      {/* Header */}
      <AppBar position="static" component="header" role="banner" elevation={1}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 1.5 }}>
            <GavelIcon aria-hidden="true" />
            <Typography
              variant="h6"
              component="h1"
              fontWeight={700}
              letterSpacing={0.5}
              sx={{ flexGrow: 1 }}
            >
              Oireachtas Bills
            </Typography>
            <Typography
              variant="caption"
              sx={{ opacity: 0.75, display: { xs: "none", sm: "block" } }}
            >
              Legislation Tracker
            </Typography>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Main */}
      <Box
        component="main"
        id="main-content"
        role="main"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          outline: "none", // prevent focus ring on skip-to-content jump
          bgcolor: "background.default",
        }}
      >
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
          {children}
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: "grey.900",
          color: "grey.400",
          py: 2,
          textAlign: "center",
        }}
      >
        <Typography variant="caption">
          Data provided by{" "}
          <Link
            href="https://api.oireachtas.ie"
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
            underline="hover"
            aria-label="Oireachtas API (opens in new tab)"
          >
            api.oireachtas.ie
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
