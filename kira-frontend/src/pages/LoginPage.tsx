import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("albert");
  const [password, setPassword] = useState("test12345");
  const [err, setErr] = useState("");

  async function onSubmit() {
    setErr("");
    try {
      await login(username, password);
      nav("/");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    }
  }

  return (
    <Container sx={{ py: 6 }}>
      <Box sx={{ maxWidth: 520, mx: "auto" }}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                Welcome back
              </Typography>
              <Typography color="text.secondary">
                Sign in to favorite listings and manage your dealer dashboard.
              </Typography>

              {err ? <Alert severity="error">{err}</Alert> : null}

              <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button variant="contained" onClick={onSubmit}>
                Sign in
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
