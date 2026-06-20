import GavelIcon from "@mui/icons-material/Gavel";
import { AppBar, Box, Container, Link, Toolbar, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static" component="header" elevation={1}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 1.5 }}>
            <GavelIcon aria-hidden="true" />
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
              Oireachtas Bills
            </Typography>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default" }}>
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
          {children}
        </Container>
      </Box>

      <Box
        component="footer"
        sx={{ bgcolor: "grey.900", color: "grey.400", py: 2, textAlign: "center" }}
      >
        <Typography variant="caption">
          Data from{" "}
          <Link
            href="https://api.oireachtas.ie"
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
            underline="hover"
          >
            api.oireachtas.ie
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
