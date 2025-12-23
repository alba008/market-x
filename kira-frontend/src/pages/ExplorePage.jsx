// src/pages/ExplorePage.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "urql";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Button,
  Chip,
  Grid,
  Divider,
  Skeleton,
  Alert,
} from "@mui/material";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import { toAbsUrl } from "../lib/media"; // ✅ same helper used on ListingDetailPage :contentReference[oaicite:2]{index=2}

const TEXT_MAIN = "rgba(244,246,248,0.96)";
const TEXT_MID = "rgba(244,246,248,0.72)";
const BORDER = "rgba(244,246,248,0.12)";
const CARD_BG = "rgba(255,255,255,0.06)";
const GOLD = "#C9A24D";

const FEATURED_Q = `
  query Featured($filters: ListingsFilterInput, $pagination: PaginationInput) {
    listingsPage(filters: $filters, pagination: $pagination) {
      results {
        id
        title
        price
        currency
        year
        make
        model
        city
        region
        isFeatured
        images { id isCover sortOrder imageUrl thumbnailUrl }
      }
    }
  }
`;

function safeAbsUrl(url) {
  if (!url) return "";
  try {
    return toAbsUrl(url);
  } catch {
    return url;
  }
}

function sortImages(images) {
  const arr = Array.isArray(images) ? images : [];
  return [...arr].sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
}

function pickCover(images) {
  const sorted = sortImages(images);
  const cover = sorted.find((x) => x?.isCover) || sorted[0];
  const raw = cover?.imageUrl || cover?.thumbnailUrl || "";
  return safeAbsUrl(raw);
}

function money(n, currency = "USD") {
  if (n == null || n === "") return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return String(n);
  }
}

export default function ExplorePage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");

  function goListings(params) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") return;
      sp.set(k, String(v));
    });
    nav(`/listings?${sp.toString()}`);
  }

  const categories = useMemo(
    () => [
      { label: "SUV", q: "SUV" },
      { label: "Sedan", q: "Sedan" },
      { label: "Pickup", q: "Pickup" },
      { label: "Luxury", q: "Luxury" },
      { label: "Toyota", q: "Toyota" },
      { label: "Nissan", q: "Nissan" },
      { label: "Family", q: "Family" },
      { label: "Budget", q: "Budget" },
    ],
    []
  );

  const budgets = useMemo(
    () => [
      { label: "Under $5k", priceMin: 0, priceMax: 5000 },
      { label: "$5k–$10k", priceMin: 5000, priceMax: 10000 },
      { label: "$10k–$20k", priceMin: 10000, priceMax: 20000 },
      { label: "$20k+", priceMin: 20000, priceMax: 200000 },
    ],
    []
  );

  const locations = useMemo(
    () => [
      { label: "Dar es Salaam", region: "Dar es Salaam", city: "" },
      { label: "Ilala", region: "Dar es Salaam", city: "Ilala" },
      { label: "Kinondoni", region: "Dar es Salaam", city: "Kinondoni" },
      { label: "Temeke", region: "Dar es Salaam", city: "Temeke" },
      { label: "Arusha", region: "Arusha", city: "" },
      { label: "Mwanza", region: "Mwanza", city: "" },
    ],
    []
  );

  // ✅ Featured preview grid (with images)
  const [{ data, fetching, error }] = useQuery({
    query: FEATURED_Q,
    variables: {
      filters: { featuredOnly: true },
      pagination: { limit: 6, offset: 0 },
    },
    requestPolicy: "cache-and-network",
  });

  const featured = data?.listingsPage?.results ?? [];

  return (
    <Box sx={{ px: { xs: 1.25, md: 3 }, py: { xs: 2, md: 3 } }}>
      {/* Hero */}
      <Card sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1.25}>
            <Typography sx={{ color: TEXT_MAIN, fontWeight: 1000, fontSize: { xs: 22, md: 28 } }}>
              Explore makutanoni
            </Typography>
            <Typography variant="body2" sx={{ color: TEXT_MID, maxWidth: 720 }}>
              Discover listings by category, budget, and location — then jump straight into results.
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="stretch" mt={1}>
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search make, model, keyword…"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <Box sx={{ mr: 1, display: "inline-flex", color: TEXT_MID }}>
                      <SearchRoundedIcon fontSize="small" />
                    </Box>
                  ),
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") goListings({ q: q.trim(), page: 1 });
                }}
              />

              <Button
                variant="contained"
                onClick={() => goListings({ q: q.trim(), page: 1 })}
                sx={{
                  bgcolor: GOLD,
                  color: "#111",
                  fontWeight: 1000,
                  textTransform: "none",
                  borderRadius: 2,
                  px: 3,
                  boxShadow: "none",
                  "&:hover": { bgcolor: "#D6B463", boxShadow: "none" },
                }}
              >
                Search
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mt={1}>
              {categories.map((c) => (
                <Chip
                  key={c.label}
                  label={c.label}
                  onClick={() => goListings({ q: c.q, page: 1 })}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.06)",
                    border: `1px solid ${BORDER}`,
                    color: TEXT_MAIN,
                    fontWeight: 900,
                    "&:hover": { borderColor: "rgba(201,162,77,0.45)" },
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Featured preview grid */}
      <Box sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography sx={{ color: TEXT_MAIN, fontWeight: 1000 }}>Featured right now</Typography>
          <Button
            onClick={() => goListings({ featuredOnly: 1, page: 1 })}
            sx={{ textTransform: "none", fontWeight: 900, color: GOLD }}
          >
            View all →
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        <Grid container spacing={2}>
          {(fetching ? Array.from({ length: 6 }) : featured).map((it, idx) => {
            const cover = fetching ? "" : pickCover(it?.images);
            const title = it?.title || `${it?.year ?? ""} ${it?.make ?? ""} ${it?.model ?? ""}`.trim() || "Listing";

            return (
              <Grid key={fetching ? idx : it.id} item xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    bgcolor: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 3,
                    overflow: "hidden",
                    cursor: fetching ? "default" : "pointer",
                    transition: "transform 160ms ease, border-color 160ms ease",
                    "&:hover": {
                      transform: fetching ? "none" : "translateY(-2px)",
                      borderColor: fetching ? BORDER : "rgba(201,162,77,0.45)",
                    },
                  }}
                  onClick={() => {
                    if (fetching) return;
                    nav(`/listing/${it.id}`);
                  }}
                >
                  {fetching ? (
                    <Skeleton variant="rectangular" height={170} />
                  ) : (
                    <Box
                      sx={{
                        height: 170,
                        bgcolor: "rgba(0,0,0,0.25)",
                        backgroundImage: cover ? `url(${cover})` : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                  )}

                  <CardContent sx={{ p: 2 }}>
                    {fetching ? (
                      <>
                        <Skeleton width="70%" />
                        <Skeleton width="45%" />
                      </>
                    ) : (
                      <Stack spacing={0.6}>
                        <Typography sx={{ color: TEXT_MAIN, fontWeight: 1000 }}>
                          {title}
                        </Typography>
                        <Typography sx={{ color: GOLD, fontWeight: 1000 }}>
                          {money(it.price, it.currency || "USD")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: TEXT_MID }}>
                          {(it.city || it.region) ? `${it.city ? it.city + ", " : ""}${it.region || ""}` : "—"}
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Curated sections */}
      <Grid container spacing={2} sx={{ mt: 0.25 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <LocalFireDepartmentRoundedIcon sx={{ color: GOLD }} />
                  <Typography sx={{ color: TEXT_MAIN, fontWeight: 1000 }}>Trending</Typography>
                </Stack>

                <Divider sx={{ borderColor: BORDER, my: 1 }} />

                <Stack spacing={0.5}>
                  <Button
                    onClick={() => goListings({ featuredOnly: 1, page: 1 })}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ justifyContent: "space-between", textTransform: "none", fontWeight: 900, color: TEXT_MAIN }}
                  >
                    Featured listings
                  </Button>
                  <Button
                    onClick={() => goListings({ yearMin: 2020, page: 1 })}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ justifyContent: "space-between", textTransform: "none", fontWeight: 900, color: TEXT_MAIN }}
                  >
                    Newer models (2020+)
                  </Button>
                  <Button
                    onClick={() => goListings({ q: "Toyota", page: 1 })}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ justifyContent: "space-between", textTransform: "none", fontWeight: 900, color: TEXT_MAIN }}
                  >
                    Toyota picks
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 3, height: "100%" }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <AutoAwesomeRoundedIcon sx={{ color: GOLD }} />
                  <Typography sx={{ color: TEXT_MAIN, fontWeight: 1000 }}>Shop by budget</Typography>
                </Stack>

                <Divider sx={{ borderColor: BORDER, my: 1 }} />

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {budgets.map((b) => (
                    <Chip
                      key={b.label}
                      label={b.label}
                      onClick={() => goListings({ priceMin: b.priceMin, priceMax: b.priceMax, page: 1 })}
                      sx={{
                        bgcolor: "rgba(201,162,77,0.12)",
                        border: "1px solid rgba(201,162,77,0.25)",
                        color: TEXT_MAIN,
                        fontWeight: 900,
                        "&:hover": { borderColor: "rgba(201,162,77,0.55)" },
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PlaceRoundedIcon sx={{ color: GOLD }} />
                  <Typography sx={{ color: TEXT_MAIN, fontWeight: 1000 }}>Explore by location</Typography>
                </Stack>

                <Divider sx={{ borderColor: BORDER, my: 1 }} />

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {locations.map((l) => (
                    <Chip
                      key={l.label}
                      label={l.label}
                      onClick={() => goListings({ region: l.region, city: l.city, page: 1 })}
                      sx={{
                        bgcolor: "rgba(255,255,255,0.06)",
                        border: `1px solid ${BORDER}`,
                        color: TEXT_MAIN,
                        fontWeight: 900,
                        "&:hover": { borderColor: "rgba(201,162,77,0.45)" },
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
