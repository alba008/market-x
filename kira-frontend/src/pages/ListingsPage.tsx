// src/pages/ListingsPage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "urql";
import Grid from "@mui/material/Grid2";
import { Box, Card, CardContent, Typography, Stack, TextField, Button, Chip, Divider, Skeleton, Drawer, IconButton, Slider, FormControlLabel, Switch, Alert, Pagination } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import { toAbsUrl } from "../lib/media"; // ✅ same helper used on ListingDetailPage :contentReference[oaicite:1]{index=1}

const TEXT_MAIN = "rgba(244,246,248,0.96)";
const TEXT_MID = "rgba(244,246,248,0.72)";
const BORDER = "rgba(244,246,248,0.12)";
const CARD_BG = "rgba(255,255,255,0.06)";
const GOLD = "#C9A24D";

const LISTINGS_PAGE_QUERY = `
  query ListingsPage($filters: ListingsFilterInput, $pagination: PaginationInput) {
    listingsPage(filters: $filters, pagination: $pagination) {
      totalCount
      pageInfo { limit offset hasNext hasPrev }
      results {
        id
        title
        slug
        price
        currency
        year
        make
        model
        mileage
        city
        region
        country
        isFeatured
        images {
          id
          isCover
          sortOrder
          imageUrl
          thumbnailUrl
        }
      }
    }
  }
`;

/* ============================
   Image helpers (same logic as detail page)
============================ */
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

export default function ListingsPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  // URL state
  const q = sp.get("q") ?? "";
  const region = sp.get("region") ?? "";
  const city = sp.get("city") ?? "";
  const featuredOnly = (sp.get("featuredOnly") ?? "0") === "1";

  const yearMin = Number(sp.get("yearMin") ?? "2000");
  const yearMax = Number(sp.get("yearMax") ?? "2026");
  const priceMin = Number(sp.get("priceMin") ?? "0");
  const priceMax = Number(sp.get("priceMax") ?? "200000");

  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const limit = 12;
  const offset = (page - 1) * limit;

  const [drawerOpen, setDrawerOpen] = useState(false);

  function updateParams(next) {
    const nextSp = new URLSearchParams(sp);
    Object.entries(next).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "" || Number.isNaN(v)) nextSp.delete(k);
      else nextSp.set(k, String(v));
    });
    setSp(nextSp, { replace: true });
  }

  const resetFilters = () => {
    updateParams({
      q: "",
      region: "",
      city: "",
      featuredOnly: 0,
      yearMin: 2000,
      yearMax: 2026,
      priceMin: 0,
      priceMax: 200000,
      page: 1,
    });
  };

  const filters = useMemo(
    () => ({
      q: q || null,
      region: region || null,
      city: city || null,
      featuredOnly: featuredOnly ? true : null,
      yearMin,
      yearMax,
      priceMin,
      priceMax,
    }),
    [q, region, city, featuredOnly, yearMin, yearMax, priceMin, priceMax]
  );

  const [{ data, fetching, error }] = useQuery({
    query: LISTINGS_PAGE_QUERY,
    variables: { filters, pagination: { limit, offset } },
    requestPolicy: "cache-and-network",
  });

  const pageData = data?.listingsPage;
  const results = pageData?.results ?? [];
  const total = pageData?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const activeChips = useMemo(() => {
    const chips = [];
    if (q) chips.push({ k: "q", label: `Search: ${q}` });
    if (region) chips.push({ k: "region", label: `Region: ${region}` });
    if (city) chips.push({ k: "city", label: `City: ${city}` });
    if (featuredOnly) chips.push({ k: "featuredOnly", label: "Featured" });
    if (yearMin !== 2000 || yearMax !== 2026) chips.push({ k: "year", label: `Year: ${yearMin}–${yearMax}` });
    if (priceMin !== 0 || priceMax !== 200000) chips.push({ k: "price", label: `Price: ${money(priceMin)}–${money(priceMax)}` });
    return chips;
  }, [q, region, city, featuredOnly, yearMin, yearMax, priceMin, priceMax]);

  const Filters = (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ color: TEXT_MAIN, fontWeight: 900 }}>Filters</Typography>
        <Button size="small" onClick={resetFilters} sx={{ color: TEXT_MID, textTransform: "none", fontWeight: 800 }}>
          Reset
        </Button>
      </Stack>

      <Divider sx={{ borderColor: BORDER }} />

      <TextField label="Region" value={region} onChange={(e) => updateParams({ region: e.target.value, page: 1 })} fullWidth />
      <TextField label="City" value={city} onChange={(e) => updateParams({ city: e.target.value, page: 1 })} fullWidth />

      <Box>
        <Typography sx={{ color: TEXT_MAIN, fontWeight: 800, mb: 1 }}>Year</Typography>
        <Slider
          value={[yearMin, yearMax]}
          onChange={(_, v) => updateParams({ yearMin: v[0], yearMax: v[1], page: 1 })}
          min={1990}
          max={2026}
          step={1}
          valueLabelDisplay="auto"
        />
      </Box>

      <Box>
        <Typography sx={{ color: TEXT_MAIN, fontWeight: 800, mb: 1 }}>Price</Typography>
        <Slider
          value={[priceMin, priceMax]}
          onChange={(_, v) => updateParams({ priceMin: v[0], priceMax: v[1], page: 1 })}
          min={0}
          max={200000}
          step={1000}
          valueLabelDisplay="auto"
        />
      </Box>

      <FormControlLabel
        control={<Switch checked={featuredOnly} onChange={(e) => updateParams({ featuredOnly: e.target.checked ? 1 : 0, page: 1 })} />}
        label={<Typography sx={{ color: TEXT_MID, fontWeight: 700 }}>Featured only</Typography>}
      />
    </Stack>
  );

  return (
    <Box sx={{ px: { xs: 1.25, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Card sx={{ bgcolor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.25}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Typography sx={{ color: TEXT_MAIN, fontWeight: 1000, fontSize: { xs: 18, md: 20 } }}>
                Listings
              </Typography>

              <Button
                onClick={() => setDrawerOpen(true)}
                startIcon={<TuneRoundedIcon />}
                sx={{
                  display: { xs: "inline-flex", md: "none" },
                  textTransform: "none",
                  fontWeight: 900,
                  color: TEXT_MAIN,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 2,
                }}
              >
                Filters
              </Button>
            </Stack>

            <TextField
              value={q}
              onChange={(e) => updateParams({ q: e.target.value, page: 1 })}
              placeholder="Search make, model, keyword…"
              fullWidth
              InputProps={{
                startAdornment: (
                  <Box sx={{ mr: 1, display: "inline-flex", color: TEXT_MID }}>
                    <SearchRoundedIcon fontSize="small" />
                  </Box>
                ),
                endAdornment: q ? (
                  <IconButton onClick={() => updateParams({ q: "", page: 1 })} size="small">
                    <ClearRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null,
              }}
            />

            {activeChips.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                {activeChips.map((c) => (
                  <Chip
                    key={c.k}
                    label={c.label}
                    sx={{
                      bgcolor: "rgba(255,255,255,0.06)",
                      border: `1px solid ${BORDER}`,
                      color: TEXT_MAIN,
                      fontWeight: 800,
                    }}
                  />
                ))}
                <Button onClick={resetFilters} size="small" sx={{ textTransform: "none", fontWeight: 900, color: GOLD }}>
                  Clear all
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
        <Card
          sx={{
            display: { xs: "none", md: "block" },
            width: 320,
            flexShrink: 0,
            bgcolor: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 3,
            height: "fit-content",
            position: "sticky",
            top: 88,
          }}
        >
          {Filters}
        </Card>

        <Box sx={{ flex: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.message}
            </Alert>
          )}

          <Typography variant="body2" sx={{ color: TEXT_MID, mb: 1 }}>
            {fetching ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`}
          </Typography>

          <Grid container spacing={2}>
            {(fetching ? Array.from({ length: 8 }) : results).map((it, idx) => {
              const cover = fetching ? "" : pickCover(it?.images);
              const title = it?.title || `${it?.year ?? ""} ${it?.make ?? ""} ${it?.model ?? ""}`.trim() || "Listing";

              return (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={fetching ? idx : it.id}>
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
                      <Skeleton variant="rectangular" height={180} />
                    ) : (
                      <Box
                        sx={{
                          height: 180,
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
                          <Skeleton width="60%" />
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

                          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.5}>
                            {it.isFeatured ? (
                              <Chip
                                label="Featured"
                                size="small"
                                sx={{
                                  bgcolor: "rgba(201,162,77,0.12)",
                                  border: "1px solid rgba(201,162,77,0.25)",
                                  color: TEXT_MAIN,
                                  fontWeight: 900,
                                }}
                              />
                            ) : (
                              <Box />
                            )}
                            <ArrowForwardRoundedIcon sx={{ color: TEXT_MID }} />
                          </Stack>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
            <Pagination
              count={totalPages}
              page={Math.min(page, totalPages)}
              onChange={(_, p) => updateParams({ page: p })}
              color="primary"
              shape="rounded"
            />
          </Stack>
        </Box>
      </Stack>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: "88vw",
            maxWidth: 360,
            bgcolor: "#1A1F27",
            color: TEXT_MAIN,
            borderLeft: `1px solid ${BORDER}`,
          },
        }}
      >
        {Filters}
      </Drawer>
    </Box>
  );
}
