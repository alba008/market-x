import { createTheme } from "@mui/material/styles";

export const kiraTheme = createTheme({
  palette: {
    mode: "dark",

    // Softer showroom gray (less “inky”)
    background: {
      default: "#171C23", // slightly lighter + cleaner than #1A1F27
      paper: "rgba(255,255,255,0.06)", // glassy surface instead of solid block
    },

    // Premium gold
    primary: {
      main: "#C9A24D",
      light: "#E0C07A",
      dark: "#9E7D2C",
    },

    text: {
      primary: "#F4F6F8",
      secondary: "rgba(244,246,248,0.74)",
    },

    divider: "rgba(244,246,248,0.10)",
  },

  typography: {
    fontFamily: [
      "Inter",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "Roboto",
      "Arial",
      "sans-serif",
    ].join(","),
    h4: { fontWeight: 900, letterSpacing: 0.2 },
    h5: { fontWeight: 800 },
    button: { textTransform: "none", fontWeight: 800 },
  },

  shape: { borderRadius: 18 },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // Showroom lighting: softer, higher up, less contrast
          backgroundImage:
            "radial-gradient(900px 540px at 16% -12%, rgba(201,162,77,0.10), transparent 60%)," +
            "radial-gradient(900px 620px at 88% -10%, rgba(255,255,255,0.07), transparent 62%)," +
            "radial-gradient(1200px 720px at 50% 115%, rgba(0,0,0,0.45), transparent 65%)",
          backgroundRepeat: "no-repeat",
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "rgba(23,28,35,0.72)", // lighter + more glass
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(244,246,248,0.08)",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "rgba(255,255,255,0.06)", // matches paper, feels “premium”
          border: "1px solid rgba(244,246,248,0.10)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.22)", // less heavy
          transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 14 },
        containedPrimary: {
          boxShadow: "0 12px 28px rgba(201,162,77,0.18)", // subtle gold glow
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.04)",
          borderRadius: 16,
        },
        notchedOutline: {
          borderColor: "rgba(244,246,248,0.12)",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.06)",
          borderColor: "rgba(244,246,248,0.12)",
        },
      },
    },
  },
});
