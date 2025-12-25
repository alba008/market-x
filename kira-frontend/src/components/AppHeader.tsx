import { useMemo, useState } from "react";
import "@fontsource/dancing-script/700.css";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  IconButton,
  Drawer,
  Stack,
  Divider,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  ListItemIcon,
} from "@mui/material";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";

// ✅ If you already have an auth context, plug it here.
// For now, safe fallback: checks localStorage for a token.
function useSimpleAuth() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access")
      : null;

  const name =
    typeof window !== "undefined"
      ? localStorage.getItem("userName") || localStorage.getItem("name") || ""
      : "";

  return { isAuthed: !!token, name };
}

const BRAND = "makutanoni";
const GOLD = "#C9A24D";
const TEXT = "rgba(244,246,248,0.92)";
const DIM = "rgba(244,246,248,0.72)";

export default function AppHeader() {
  const nav = useNavigate();
  const { isAuthed, name } = useSimpleAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);

  // ✅ TS FIX: anchor must be HTMLElement | null (not just null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const links = useMemo(
    () => [
      { label: "Home", to: "/" },
      { label: "Explore", to: "/explore" },
      { label: "Listings", to: "/listings" },
      { label: "Contact", to: "/contact" },
    ],
    []
  );

  const displayName = (name || "Account").trim();

  const closeMenus = () => {
    setMenuAnchor(null);
    setDrawerOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("token");
    localStorage.removeItem("access");
    localStorage.removeItem("userName");
    localStorage.removeItem("name");

    closeMenus();
    nav("/login");
  };

  const AuthAreaDesktop = (
    <Stack direction="row" spacing={1} alignItems="center">
      {!isAuthed ? (
        <>
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            sx={{
              color: TEXT,
              borderColor: "rgba(244,246,248,0.18)",
              fontWeight: 900,
              textTransform: "none",
              borderRadius: 999,
              px: 2,
              "&:hover": { borderColor: "rgba(201,162,77,0.45)" },
            }}
          >
            Sign in
          </Button>

          <Tooltip title="Sign up page coming soon">
            <span>
              <Button
                disabled
                variant="contained"
                sx={{
                  bgcolor: GOLD,
                  color: "#111",
                  fontWeight: 900,
                  textTransform: "none",
                  borderRadius: 999,
                  px: 2,
                  boxShadow: "none",
                  opacity: 0.65,
                }}
              >
                Sign up
              </Button>
            </span>
          </Tooltip>
        </>
      ) : (
        <>
          <Tooltip title="Account">
            <Button
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{
                textTransform: "none",
                borderRadius: 999,
                px: 1,
                py: 0.6,
                border: "1px solid rgba(244,246,248,0.14)",
                bgcolor: "rgba(255,255,255,0.04)",
                color: TEXT,
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                "&:hover": { borderColor: "rgba(201,162,77,0.45)" },
              }}
            >
              <Avatar
                sx={{
                  width: 26,
                  height: 26,
                  bgcolor: "rgba(201,162,77,0.18)",
                  color: TEXT,
                  fontWeight: 900,
                }}
              >
                {displayName?.[0]?.toUpperCase() || "U"}
              </Avatar>

              <Typography sx={{ color: TEXT, fontWeight: 900 }}>
                {displayName}
              </Typography>
            </Button>
          </Tooltip>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 220,
                bgcolor: "#1A1F27",
                color: TEXT,
                border: "1px solid rgba(244,246,248,0.12)",
                borderRadius: 2,
              },
            }}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                nav("/dashboard");
              }}
              sx={{ fontWeight: 800 }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: DIM }}>
                <DashboardRoundedIcon fontSize="small" />
              </ListItemIcon>
              Dashboard
            </MenuItem>

            <Divider sx={{ borderColor: "rgba(244,246,248,0.12)" }} />

            <MenuItem onClick={handleLogout} sx={{ fontWeight: 800 }}>
              <ListItemIcon sx={{ minWidth: 34, color: DIM }}>
                <LogoutRoundedIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </>
      )}
    </Stack>
  );

  const AuthAreaMobile = (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {!isAuthed ? (
        <>
          <Button
            component={RouterLink}
            to="/login"
            onClick={() => setDrawerOpen(false)}
            fullWidth
            variant="outlined"
            sx={{
              justifyContent: "center",
              color: TEXT,
              borderColor: "rgba(244,246,248,0.18)",
              fontWeight: 900,
              textTransform: "none",
              borderRadius: 2,
              py: 1.1,
              "&:hover": { borderColor: "rgba(201,162,77,0.45)" },
            }}
          >
            Sign in
          </Button>

          <Tooltip title="Sign up page coming soon">
            <span>
              <Button
                disabled
                fullWidth
                variant="contained"
                sx={{
                  bgcolor: GOLD,
                  color: "#111",
                  fontWeight: 900,
                  textTransform: "none",
                  borderRadius: 2,
                  py: 1.15,
                  boxShadow: "none",
                  opacity: 0.65,
                }}
              >
                Sign up
              </Button>
            </span>
          </Tooltip>
        </>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 1,
              py: 1,
              border: "1px solid rgba(244,246,248,0.12)",
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.04)",
            }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "rgba(201,162,77,0.18)",
                color: TEXT,
                fontWeight: 900,
              }}
            >
              {displayName?.[0]?.toUpperCase() || "U"}
            </Avatar>

            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: TEXT, fontWeight: 900, lineHeight: 1.1 }}>
                {displayName}
              </Typography>
              <Typography variant="body2" sx={{ color: DIM }}>
                Account
              </Typography>
            </Box>

            <PersonRoundedIcon sx={{ color: DIM }} />
          </Box>

          <Button
            onClick={() => {
              setDrawerOpen(false);
              nav("/dashboard");
            }}
            fullWidth
            sx={{
              justifyContent: "flex-start",
              color: TEXT,
              fontWeight: 900,
              textTransform: "none",
              borderRadius: 2,
              py: 1.1,
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
            }}
          >
            Dashboard
          </Button>

          <Button
            onClick={handleLogout}
            fullWidth
            sx={{
              justifyContent: "flex-start",
              color: TEXT,
              fontWeight: 900,
              textTransform: "none",
              borderRadius: 2,
              py: 1.1,
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
            }}
          >
            Logout
          </Button>
        </>
      )}
    </Stack>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(26,31,39,0.72)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(244,246,248,0.12)",
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 64, md: 72 },
            px: { xs: 1.25, sm: 2, md: 3 },
            display: "flex",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
            <Typography
              component={RouterLink}
              to="/"
              sx={{
                textDecoration: "none",
                color: "rgba(244,246,248,0.96)",
                fontFamily: `"Dancing Script", cursive`,
                fontWeight: 700,
                fontSize: { xs: 28, sm: 30, md: 34 },
                letterSpacing: 0.3,
                lineHeight: 1,
                textTransform: "none",
                display: "inline-flex",
                alignItems: "baseline",
              }}
            >
              {BRAND}
              <Box
                component="span"
                sx={{
                  ml: 1,
                  fontFamily:
                    "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                  fontWeight: 800,
                  fontSize: { xs: 10, sm: 11, md: 12 },
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "rgba(201,162,77,0.95)",
                }}
              >
                marketplace
              </Box>
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={0.5}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            {links.map((l) => (
              <Button
                key={l.to}
                component={RouterLink}
                to={l.to}
                sx={{
                  color: "rgba(244,246,248,0.88)",
                  fontWeight: 800,
                  textTransform: "none",
                  px: 1.25,
                  borderRadius: 999,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                }}
              >
                {l.label}
              </Button>
            ))}
            {AuthAreaDesktop}
          </Stack>

          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              color: TEXT,
              border: "1px solid rgba(244,246,248,0.14)",
              borderRadius: 2,
            }}
            aria-label="Open menu"
          >
            <MenuRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: "88vw",
            maxWidth: 360,
            bgcolor: "#1A1F27",
            color: TEXT,
            borderLeft: "1px solid rgba(244,246,248,0.12)",
          },
        }}
      >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            component={RouterLink}
            to="/"
            onClick={() => setDrawerOpen(false)}
            sx={{
              flex: 1,
              textDecoration: "none",
              fontFamily: `"Dancing Script", cursive`,
              fontWeight: 700,
              fontSize: 30,
              color: "rgba(244,246,248,0.96)",
            }}
          >
            {BRAND}
          </Typography>

          <IconButton
            onClick={() => setDrawerOpen(false)}
            sx={{ color: TEXT }}
            aria-label="Close menu"
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: "rgba(244,246,248,0.12)" }} />

        <Stack sx={{ p: 2 }} spacing={1}>
          {links.map((l) => (
            <Button
              key={l.to}
              component={RouterLink}
              to={l.to}
              onClick={() => setDrawerOpen(false)}
              fullWidth
              sx={{
                justifyContent: "flex-start",
                color: TEXT,
                fontWeight: 900,
                textTransform: "none",
                borderRadius: 2,
                py: 1.1,
                "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              {l.label}
            </Button>
          ))}

          <Divider sx={{ borderColor: "rgba(244,246,248,0.12)", my: 1 }} />

          {AuthAreaMobile}
        </Stack>
      </Drawer>
    </>
  );
}
