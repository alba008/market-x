import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "urql";
import { Alert, Box, Button, Card, CardContent, Chip, Container, Divider, InputAdornment, Pagination, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
// ✅ MUI v7 Grid2 (supports `size={{ xs, md }}`; does NOT use `item/xs/md`)
import Grid from "@mui/material/Grid";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import MarketplaceHero from "../components/MarketplaceHero";

/**
 * V2 Query (page + filters + images)
 * Note: we ask for thumbnailUrl + imageUrl like V1.
 */
const LISTINGS_PAGE_V2 = `
query ListingsPageV2($limit: Int!, $offset: Int!, $filters: ListingsV2FilterInput) {
  listingsPageV2(pagination:{limit:$limit, offset:$offset}, filters: $filters) {
    totalCount
    pageInfo { limit offset hasNext hasPrev }
    results {
      id
      title
      slug
      price
      currency
      city
      region
      country
      isFeatured
      isFavorited
      createdAt
      category { id name slug }
      dealer { id dealershipName city region isVerified }
      images { id thumbnailUrl imageUrl isCover sortOrder }
      attributeValues { attribute { key label } value }
    }
  }
}
`;

const CATEGORIES = `
query Categories {
  categories { id name slug }
}
`;

const TOGGLE_FAV_V2 = `
mutation ToggleFavV2($id: ID!) { toggleFavoriteV2(listingId: $id) }
`;

/** ---------- helpers ---------- */

function clampInt(v: string, min?: number, max?: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const x = Math.trunc(n);
  if (min != null && x < min) return String(min);
  if (max != null && x > max) return String(max);
  return String(x);
}

function money(n: any, currency = "USD") {
  if (n == null) return "—";
  const val = Number(n);
  if (!Number.isFinite(val)) return String(n);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(val);
  } catch {
    return `${val}`;
  }
}

/**
 * Fix for "images not showing" in V2:
 * If backend returns relative URLs like "/media/..", we make them absolute.
 */
function resolveMediaUrl(raw?: string | null) {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const base =
    (import.meta.env.VITE_MEDIA_BASE_URL ||
      import.meta.env.VITE_BACKEND_URL ||
      "").trim();

  if (base) return `${base.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;

  const gql = (import.meta.env.VITE_GRAPHQL_URL || "").trim();
  if (gql) {
    const derived = gql.replace(/\/graphql\/?$/i, "");
    if (/^https?:\/\//i.test(derived)) {
      return `${derived.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
    }
  }
  return url;
}


function pickCoverImage(images: any[] | undefined | null) {
  const imgs = images || [];
  const cover =
    imgs.find((im) => im?.isCover && (im?.thumbnailUrl || im?.imageUrl)) ||
    imgs.find((im) => im?.thumbnailUrl || im?.imageUrl) ||
    imgs[0];

  const src = resolveMediaUrl(cover?.thumbnailUrl || cover?.imageUrl || "");
  return src;
}

/** ---------- card ---------- */

function ListingV2Card({
  item,
  onOpen,
  onToggleFav,
}: {
  item: any;
  onOpen: () => void;
  onToggleFav: () => void;
}) {
  const img = pickCoverImage(item?.images);
  const title = item?.title || "Listing";
  const subtitle = `${item?.category?.name || "Category"} • ${item?.city || "—"}${
    item?.region ? `, ${item.region}` : ""
  }`;

  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid rgba(244,246,248,0.10)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        transition: "transform .18s ease, border-color .18s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          borderColor: "rgba(201,162,77,0.30)",
        },
      }}
    >
      <Box onClick={onOpen} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
        <Box
          sx={{
            height: 190,
            backgroundColor: "rgba(255,255,255,0.04)",
            backgroundImage: img ? `url("${img}")` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
          }}
        >
          {/* overlay */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.00) 35%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          <Stack
            direction="row"
            spacing={1}
            sx={{ position: "absolute", left: 12, top: 12, flexWrap: "wrap" }}
            useFlexGap
          >
            {item?.isFeatured ? (
              <Chip
                size="small"
                icon={<LocalFireDepartmentRoundedIcon fontSize="small" />}
                label="Featured"
                sx={{
                  bgcolor: "rgba(201,162,77,0.18)",
                  border: "1px solid rgba(201,162,77,0.25)",
                  color: "rgba(244,246,248,0.95)",
                  "& .MuiChip-icon": { color: "#C9A24D" },
                }}
              />
            ) : null}

            <Chip
              size="small"
              label={item?.category?.name || "—"}
              sx={{
                bgcolor: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(244,246,248,0.12)",
                color: "rgba(244,246,248,0.92)",
              }}
            />
          </Stack>

          <Box sx={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
            <Typography
              sx={{
                color: "rgba(255,255,255,0.96)",
                fontWeight: 950,
                lineHeight: 1.1,
                textShadow: "0 8px 18px rgba(0,0,0,.45)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.78)", fontSize: 12 }}>
              {subtitle}
            </Typography>
          </Box>
        </Box>
      </Box>

      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: 950 }}>
              {money(item?.price, item?.currency || "USD")}
            </Typography>

            <Button
              size="small"
              variant={item?.isFavorited ? "contained" : "outlined"}
              onClick={onToggleFav}
              sx={{
                minWidth: 0,
                px: 1.3,
                borderRadius: 2,
                borderColor: "rgba(244,246,248,0.16)",
                bgcolor: item?.isFavorited ? "rgba(201,162,77,0.22)" : "transparent",
              }}
            >
              {item?.isFavorited ? "Saved" : "Save"}
            </Button>
          </Stack>

          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {item?.dealer?.dealershipName || "Dealer"} {item?.dealer?.isVerified ? "• Verified" : ""}
          </Typography>

          {(item?.attributeValues || []).length > 0 && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
              {(item.attributeValues as any[]).slice(0, 3).map((av, idx) => (
                <Chip
                  key={`${item.id}-av-${idx}`}
                  size="small"
                  variant="outlined"
                  label={`${av?.attribute?.label || av?.attribute?.key}: ${String(av?.value ?? "—")}`}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** ---------- page ---------- */

export default function MarketplaceV2Page() {
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

  // category filter
  const [categorySlug, setCategorySlug] = useState<string>("");

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
  }, [q, featuredOnly, categorySlug, priceMin, priceMax]);

  const filters = useMemo(() => {
    const f: any = {};
    if (q) f.q = q;
    if (featuredOnly) f.featuredOnly = true;
    if (categorySlug) f.categorySlug = categorySlug;

    if (priceMin) f.priceMin = Number(priceMin);
    if (priceMax) f.priceMax = Number(priceMax);

    return f;
  }, [q, featuredOnly, categorySlug, priceMin, priceMax]);

  const [{ data: catsData, fetching: catsLoading }] = useQuery({
    query: CATEGORIES,
    requestPolicy: "cache-and-network",
  });

  const categories = catsData?.categories ?? [];

  const [{ data, fetching, error }, reexec] = useQuery({
    query: LISTINGS_PAGE_V2,
    variables: { limit, offset, filters },
    requestPolicy: "cache-and-network",
  });

  const [, toggleFav] = useMutation(TOGGLE_FAV_V2);

  const total = data?.listingsPageV2?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const items: any[] = data?.listingsPageV2?.results ?? [];

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
    if (featuredOnly) chips.push({ key: "feat", label: "Featured only", onClear: () => setFeaturedOnly(false) });

    if (categorySlug) {
      const name = categories.find((c: any) => c.slug === categorySlug)?.name || categorySlug;
      chips.push({ key: "cat", label: `Category: ${name}`, onClear: () => setCategorySlug("") });
    }

    if (priceMin) chips.push({ key: "pmin", label: `Price ≥ ${priceMin}`, onClear: () => setPriceMin("") });
    if (priceMax) chips.push({ key: "pmax", label: `Price ≤ ${priceMax}`, onClear: () => setPriceMax("") });

    return chips;
  }, [q, featuredOnly, categorySlug, priceMin, priceMax, categories]);

  function clearAll() {
    setQInput("");
    setFeaturedOnly(false);
    setCategorySlug("");
    setPriceMin("");
    setPriceMax("");
  }

  return (
    <>
      <MarketplaceHero />

      <Container sx={{ py: { xs: 3, md: 4 } }}>
        <Box
          sx={{
            mb: 2.5,
            p: { xs: 2.25, md: 3 },
            borderRadius: 3,
            border: "1px solid rgba(244,246,248,0.10)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          }}
        >
          <Stack spacing={1.1}>
            <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0.2, lineHeight: 1.1 }}>
              Discover deals across every category.
            </Typography>

            <Typography color="text.secondary">
              One marketplace • Unified favorites • Category-based attributes • Built to scale
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search cars, homes, phones, excavators…"
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

            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }} useFlexGap>
              <Chip
                label="All categories"
                onClick={() => setCategorySlug("")}
                variant={categorySlug ? "outlined" : "filled"}
                color={categorySlug ? "default" : "primary"}
              />
              {catsLoading
                ? Array.from({ length: 4 }).map((_, i) => <Chip key={i} label="…" variant="outlined" />)
                : categories.map((c: any) => (
                    <Chip
                      key={c.slug}
                      label={c.name}
                      onClick={() => setCategorySlug(c.slug)}
                      variant={categorySlug === c.slug ? "filled" : "outlined"}
                      color={categorySlug === c.slug ? "primary" : "default"}
                    />
                  ))}
            </Stack>

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

                {/* ✅ Grid2: remove item/xs/md, use size={{...}} */}
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Price min"
                      value={priceMin}
                      onChange={(e) => setPriceMin(clampInt(e.target.value, 0))}
                      placeholder="5000"
                    />
                  </Grid>

                  <Grid size={{ xs: 6, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Price max"
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
                      Next: dynamic filters per category (categoryAttributes + attribute filters).
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

                  <Button size="small" variant="outlined" onClick={() => reexec({ requestPolicy: "network-only" })}>
                    Refresh
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {error && <Alert severity="error">{error.message}</Alert>}

        <Grid container spacing={2}>
          {(fetching ? Array.from({ length: 12 }) : items).map((it: any, idx: number) => (
            // ✅ Grid2: remove item/xs/sm/md/lg, use size={{...}}
            <Grid key={it?.id ?? idx} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              {it ? (
                <ListingV2Card
                  item={it}
                  onOpen={() => nav(`/m/v2/${it.slug}`)}
                  onToggleFav={() => onToggleFavorite(it.id)}
                />
              ) : (
                <Box
                  sx={{
                    height: 340,
                    borderRadius: 3,
                    border: "1px solid rgba(244,246,248,0.10)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  }}
                />
              )}
            </Grid>
          ))}
        </Grid>

        <Stack alignItems="center" sx={{ mt: 4 }}>
          <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} color="primary" shape="rounded" />
        </Stack>
      </Container>
    </>
  );
}
