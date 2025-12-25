import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "urql";
import Grid from "@mui/material/Grid2";
import { Alert, Box, Button, Card, CardContent, Chip, Container, Divider, InputAdornment, Pagination, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";

import { CarCard, type Listing } from "../components/CarCard";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import MarketplaceHero from "../components/MarketplaceHero";

const LISTINGS_PAGE = `
query ListingsPage($limit: Int!, $offset: Int!, $filters: ListingsFilterInput) {
  listingsPage(pagination:{limit:$limit, offset:$offset}, filters: $filters) {
    totalCount
    pageInfo { limit offset hasNext hasPrev }
    results {
      id title price year make model city region isFavorited
      dealer { id dealershipName city region }
      images { id thumbnailUrl imageUrl isCover sortOrder }
    }
  }
}
`;

const TOGGLE_FAV = `
mutation ToggleFav($id: ID!) { toggleFavorite(listingId: $id) }
`;

function clampInt(v: string, min?: number, max?: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const x = Math.trunc(n);
  if (min != null && x < min) return String(min);
  if (max != null && x > max) return String(max);
  return String(x);
}

export default function MarketplacePage() {
  const nav = useNavigate();
  const { isAuthed } = useAuth();

  // pagination
  const [page, setPage] = useState(1);
  const limit = 12;
  const offset = (page - 1) * limit;

  // filters (UI)
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState(""); // debounced
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const [showFilters, setShowFilters] = useState(true);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, featuredOnly, make, model, yearMin, yearMax, priceMin, priceMax]);

  const filters = useMemo(() => {
    const f: any = {};
    if (q) f.q = q;
    if (featuredOnly) f.featuredOnly = true;

    if (make.trim()) f.make = make.trim();
    if (model.trim()) f.model = model.trim();

    if (yearMin) f.yearMin = Number(yearMin);
    if (yearMax) f.yearMax = Number(yearMax);

    if (priceMin) f.priceMin = Number(priceMin);
    if (priceMax) f.priceMax = Number(priceMax);

    return f;
  }, [q, featuredOnly, make, model, yearMin, yearMax, priceMin, priceMax]);

  const [{ data, fetching, error }, reexec] = useQuery({
    query: LISTINGS_PAGE,
    variables: { limit, offset, filters },
    requestPolicy: "cache-and-network",
  });

  const [, toggleFav] = useMutation(TOGGLE_FAV);

  const total = data?.listingsPage?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const items: Listing[] = data?.listingsPage?.results ?? [];

  async function onToggleFavorite(listingId: string) {
    if (!isAuthed) {
      nav("/login");
      return;
    }
    await toggleFav({ id: listingId });
    reexec({ requestPolicy: "network-only" });
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (q) chips.push({ key: "q", label: `Search: ${q}`, onClear: () => setQInput("") });
    if (featuredOnly)
      chips.push({ key: "feat", label: "Featured only", onClear: () => setFeaturedOnly(false) });
    if (make) chips.push({ key: "make", label: `Make: ${make}`, onClear: () => setMake("") });
    if (model) chips.push({ key: "model", label: `Model: ${model}`, onClear: () => setModel("") });
    if (yearMin) chips.push({ key: "ymin", label: `Year ≥ ${yearMin}`, onClear: () => setYearMin("") });
    if (yearMax) chips.push({ key: "ymax", label: `Year ≤ ${yearMax}`, onClear: () => setYearMax("") });
    if (priceMin)
      chips.push({ key: "pmin", label: `Price ≥ ${priceMin}`, onClear: () => setPriceMin("") });
    if (priceMax)
      chips.push({ key: "pmax", label: `Price ≤ ${priceMax}`, onClear: () => setPriceMax("") });
    return chips;
  }, [q, featuredOnly, make, model, yearMin, yearMax, priceMin, priceMax]);

  function clearAll() {
    setQInput("");
    setFeaturedOnly(false);
    setMake("");
    setModel("");
    setYearMin("");
    setYearMax("");
    setPriceMin("");
    setPriceMax("");
  }

  return (
    <>
      <MarketplaceHero />

      <Container sx={{ py: { xs: 3, md: 4 } }}>
        {/* HEADER */}
        <Box
          sx={{
            mb: 2.5,
            p: { xs: 2.25, md: 3 },
            borderRadius: 3,
            border: "1px solid rgba(244,246,248,0.10)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          }}
        >
          <Stack spacing={1.1}>
            <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0.2, lineHeight: 1.1 }}>
              Find your next car — fast.
            </Typography>

            <Typography color="text.secondary">
              Premium marketplace • Verified dealers • Instant thumbnails • Clean detail pages
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search Toyota, RAV4, 2017, SUV, Dar es Salaam…"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon />
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
                <Button
                  onClick={() => setShowFilters((s) => !s)}
                  variant="outlined"
                  startIcon={<TuneRoundedIcon />}
                  sx={{ whiteSpace: "nowrap", flex: { xs: 1, md: "none" } }}
                >
                  Filters
                </Button>

                <ToggleButtonGroup
                  exclusive
                  value={featuredOnly ? "featured" : "all"}
                  onChange={(_, v) => setFeaturedOnly(v === "featured")}
                  sx={{ flex: { xs: 1, md: "none" } }}
                >
                  <ToggleButton value="all" sx={{ px: 2.2 }}>
                    All
                  </ToggleButton>
                  <ToggleButton value="featured" sx={{ px: 2.2 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <LocalFireDepartmentRoundedIcon fontSize="small" />
                      <span>Featured</span>
                    </Stack>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Stack>

            {/* active chips */}
            {activeChips.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }} useFlexGap>
                {activeChips.map((c) => (
                  <Chip key={c.key} label={c.label} onDelete={c.onClear} variant="outlined" />
                ))}
                <Chip label="Clear all" onClick={clearAll} color="primary" variant="outlined" />
              </Stack>
            )}
          </Stack>
        </Box>

        {/* FILTERS PANEL */}
        {showFilters && (
          <Card sx={{ mb: 2.25 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontWeight: 900 }}>Refine results</Typography>
                  <Button size="small" onClick={clearAll}>
                    Reset
                  </Button>
                </Stack>

                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Make"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      placeholder="Toyota"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="RAV4"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Year min"
                      value={yearMin}
                      onChange={(e) => setYearMin(clampInt(e.target.value, 1980, 2035))}
                      placeholder="2015"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Year max"
                      value={yearMax}
                      onChange={(e) => setYearMax(clampInt(e.target.value, 1980, 2035))}
                      placeholder="2022"
                    />
                  </Grid>

                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Price min (USD)"
                      value={priceMin}
                      onChange={(e) => setPriceMin(clampInt(e.target.value, 0))}
                      placeholder="5000"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Price max (USD)"
                      value={priceMax}
                      onChange={(e) => setPriceMax(clampInt(e.target.value, 0))}
                      placeholder="25000"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box
                      sx={{
                        height: "100%",
                        borderRadius: 2,
                        border: "1px dashed rgba(244,246,248,0.18)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        px: 2,
                        color: "text.secondary",
                      }}
                    >
                      Next: location filters (country/region/city) + sort dropdown.
                    </Box>
                  </Grid>
                </Grid>

                <Divider />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography color="text.secondary">
                    Showing{" "}
                    <b style={{ color: "rgba(244,246,248,0.95)" }}>{items.length}</b> of{" "}
                    <b style={{ color: "rgba(244,246,248,0.95)" }}>{total}</b> listings
                  </Typography>

                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => reexec({ requestPolicy: "network-only" })}
                  >
                    Refresh
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {error && <Alert severity="error">{error.message}</Alert>}

        {/* GRID */}
        <Grid container spacing={2}>
          {(fetching ? Array.from({ length: 12 }) : items).map((it: any, idx: number) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={it?.id ?? idx}>
              {it ? (
                <CarCard
                  item={it}
                  onOpen={() => nav(`/listing/${it.id}`)}
                  onToggleFav={() => onToggleFavorite(it.id)}
                />
              ) : (
                <Box
                  sx={{
                    height: 320,
                    borderRadius: 3,
                    border: "1px solid rgba(244,246,248,0.10)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  }}
                />
              )}
            </Grid>
          ))}
        </Grid>

        {/* PAGINATION */}
        <Stack alignItems="center" sx={{ mt: 4 }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
            shape="rounded"
          />
        </Stack>
      </Container>
    </>
  );
}
