import { Box, Container, Typography } from "@mui/material";
import { Routes, Route } from "react-router-dom";
import AppHeader from "./components/AppHeader";

import MarketplacePage from "./pages/MarketplacePage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MarketplaceV2 from "./pages/MarketplaceV2";

// ✅ NEW
import ExplorePage from "./pages/ExplorePage";
import ListingsPage from "./pages/ListingsPage";

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader />

      <Box sx={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<MarketplaceV2 />} />
          <Route path="/marketplace-v2" element={<MarketplaceV2 />} />

          {/* ✅ NEW */}
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/listings" element={<ListingsPage />} />

          {/* keep your existing detail route */}
          <Route path="/listing/:id" element={<ListingDetailPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </Box>

      <Box sx={{ py: 3, borderTop: "1px solid rgba(244,246,248,0.10)" }}>
        <Container>
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} Makutanoni — trusted vehicle marketplace
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
