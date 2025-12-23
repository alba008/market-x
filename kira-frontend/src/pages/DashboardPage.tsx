import { Container, Typography } from "@mui/material";

export default function DashboardPage() {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 900 }}>
        Dealer Dashboard
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Next: My Listings, Upload Images, Leads, Profile.
      </Typography>
    </Container>
  );
}
