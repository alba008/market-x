// src/pages/MarketplaceV2.tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "urql";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  InputAdornment,
  Pagination,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import DevicesOtherRoundedIcon from "@mui/icons-material/DevicesOtherRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import ChairRoundedIcon from "@mui/icons-material/ChairRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import MarketplaceHero from "../components/MarketplaceHero";
import SeasonalShell from "../components/SeasonalShell";

const LISTINGS_PAGE = `
query ListingsPage($limit: Int!, $offset: Int!, $filters: ListingsFilterInput) {
  listingsPage(pagination:{limit:$limit, offset:$offset}, filters: $filters) {
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
      status
      isFeatured
      isFavorited
      createdAt
      dealer { dealershipName phone whatsapp city region country }
      images { id thumbnailUrl imageUrl isCover sortOrder }
    }
  }
}
`;

const CATEGORIES = `
query Categories {
  categories { id name slug }
}
`;

const TOGGLE_FAV = `
mutation ToggleFav($id: ID!) { toggleFavorite(listingId: $id) }
`;

type Category = { id: string; name: string; slug: string };

type ListingImage = {
  id?: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  isCover?: boolean | null;
  sortOrder?: number | null;
};

type Dealer = {
  dealershipName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
};

type Listing = {
  id: string;
  title?: string | null;
  slug?: string | null;
  price?: number | string | null;
  currency?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  status?: string | null;
  isFeatured?: boolean | null;
  isFavorited?: boolean | null;
  createdAt?: string | null;
  dealer?: Dealer | null;
  images?: ListingImage[] | null;
};

type ListingsPageResponse = {
  listingsPage?: {
    totalCount?: number;
    results?: Listing[];
  };
};

type CategoriesResponse = {
  categories?: Category[];
};

function clampInt(v: string, min?: number, max?: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const x = Math.trunc(n);
  if (min != null && x < min) return String(min);
  if (max != null && x > max) return String(max);
  return String(x);
}

function money(n: unknown, currency = "USD") {
  if (n == null) return "—";
  const val = Number(n);
  if (!Number.isFinite(val)) return String(n);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(val);
  } catch {
    return `${val}`;
  }
}

function resolveMediaUrl(raw?: string | null) {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const env = (import.meta as any).env || {};
  const base = (env.VITE_MEDIA_BASE_URL || env.VITE_BACKEND_URL || "").trim();

  if (base) return `${String(base).replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;

  const gql = String(env.VITE_GRAPHQL_URL || "").trim();
  if (gql) {
    const derived = gql.replace(/\/graphql\/?$/i, "");
    if (/^https?:\/\//i.test(derived)) {
      return `${derived.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
    }
  }
  return url;
}

function pickCoverImage(images?: ListingImage[] | null) {
  const imgs = Array.isArray(images) ? images : [];
  const sorted = [...imgs].sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));

  const cover =
    sorted.find((im) => Boolean(im?.isCover) && (im?.thumbnailUrl || im?.imageUrl)) ||
    sorted.find((im) => im?.thumbnailUrl || im?.imageUrl) ||
    sorted[0];

  const raw = cover?.thumbnailUrl || cover?.imageUrl || "";
  return resolveMediaUrl(raw);
}

/** ✅ Category visuals (frontend mapping for now)
 * Put real images in: /public/categories/*.jpg (or .png)
 * Later: if backend adds category.imageUrl, we swap to that.
 */
const CATEGORY_VISUALS: Record<
  string,
  { img?: string; icon: any; glow: string; ring: string }
> = {
  vehicles: {
    img: "/categories/vehicles.jpg",
    icon: DirectionsCarRoundedIcon,
    glow: "rgba(201,162,77,.20)",
    ring: "rgba(245,222,179,.55)",
  },
  electronics: {
    img: "/categories/electronics.jpg",
    icon: DevicesOtherRoundedIcon,
    glow: "rgba(100,210,255,.18)",
    ring: "rgba(100,210,255,.55)",
  },
  real_estate: {
    img: "/categories/realestate.jpg",
    icon: HomeRoundedIcon,
    glow: "rgba(125,245,180,.16)",
    ring: "rgba(125,245,180,.50)",
  },
  jobs: {
    img: "/categories/jobs.jpg",
    icon: WorkRoundedIcon,
    glow: "rgba(255,180,110,.16)",
    ring: "rgba(255,180,110,.50)",
  },
  fashion: {
    img: "/categories/fashion.jpg",
    icon: ShoppingBagRoundedIcon,
    glow: "rgba(255,120,210,.16)",
    ring: "rgba(255,120,210,.50)",
  },
  furniture: {
    img: "/categories/furniture.jpg",
    icon: ChairRoundedIcon,
    glow: "rgba(200,160,120,.16)",
    ring: "rgba(200,160,120,.50)",
  },
  default: {
    img: "/categories/default.jpg",
    icon: MoreHorizRoundedIcon,
    glow: "rgba(245,222,179,.14)",
    ring: "rgba(245,222,179,.40)",
  },
};

function CategoryOrb({
  cat,
  active,
  onClick,
}: {
  cat: Category;
  active: boolean;
  onClick: () => void;
}) {
  const v = CATEGORY_VISUALS[cat.slug] || CATEGORY_VISUALS.default;
  const Icon = v.icon;
  const img = v.img;

  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      sx={{
        cursor: "pointer",
        userSelect: "none",
        width: 118,
        textAlign: "center",
        outline: "none",
      }}
    >
      <Box
        sx={{
          width: 92,
          height: 92,
          mx: "auto",
          borderRadius: "999px",
          position: "relative",
          overflow: "hidden",
          border: active
            ? `2px solid ${v.ring}`
            : "1px solid rgba(244,246,248,0.14)",
          boxShadow: active
            ? `0 0 26px ${v.glow}`
            : "0 10px 30px rgba(0,0,0,0.35)",
          transform: active ? "translateY(-2px)" : "none",
          transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            borderColor: v.ring,
            boxShadow: `0 0 26px ${v.glow}`,
          },
          backgroundColor: "rgba(255,255,255,.04)",
          backgroundImage: img ? `url("${img}")` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* overlay */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,.10) 0%, rgba(0,0,0,.55) 75%, rgba(0,0,0,.70) 100%)",
          }}
        />

        {/* icon badge */}
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 40,
            height: 40,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            bgcolor: active ? "rgba(245,222,179,.16)" : "rgba(255,255,255,.10)",
            border: "1px solid rgba(255,255,255,.14)",
            color: active ? "#f5deb3" : "rgba(244,246,248,.92)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Icon fontSize="small" />
        </Box>
      </Box>

      <Typography
        sx={{
          mt: 1,
          fontSize: 13,
          fontWeight: 900,
          color: active ? "#f5deb3" : "rgba(244,246,248,.92)",
          lineHeight: 1.1,
        }}
      >
        {cat.name}
      </Typography>
    </Box>
  );
}

function ListingCard({
  item,
  onOpen,
  onToggleFav,
}: {
  item: Listing;
  onOpen: () => void;
  onToggleFav: () => void;
}) {
  const img = pickCoverImage(item?.images);
  const title = item?.title || "Listing";
  const subtitle = `${item?.city || "—"}${item?.region ? `, ${item.region}` : ""}${
    item?.country ? ` • ${item.country}` : ""
  }`;

  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid rgba(244,246,248,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        transition:
          "transform .18s ease, border-color .18s ease, box-shadow .18s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          borderColor: "rgba(201,162,77,0.30)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.35)",
        },
      }}
    >
      <Box onClick={onOpen} role="button" tabIndex={0} sx={{ cursor: "pointer" }}>
        <Box
          sx={{
            height: 200,
            backgroundColor: "rgba(255,255,255,0.04)",
            backgroundImage: img ? `url("${img}")` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.00) 35%, rgba(0,0,0,0.60) 100%)",
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

            {item?.status ? (
              <Chip
                size="small"
                label={item.status}
                sx={{
                  bgcolor: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(244,246,248,0.12)",
                  color: "rgba(244,246,248,0.92)",
                }}
              />
            ) : null}
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
            {item?.dealer?.dealershipName || "Dealer"}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function MarketplaceV2Page() {
  const nav = useNavigate();
  const { isAuthed } = useAuth();

  const [page, setPage] = useState(1);
  const limit = 12;
  const offset = (page - 1) * limit;

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const [categorySlug, setCategorySlug] = useState<string>("");

  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [q, featuredOnly, categorySlug, priceMin, priceMax]);

  const [{ data: catsData, fetching: catsLoading }] = useQuery<CategoriesResponse>({
    query: CATEGORIES,
    requestPolicy: "cache-and-network",
  });
  const categories = catsData?.categories ?? [];

  const filters = useMemo(() => {
    const f: Record<string, any> = {};
    if (q) f.q = q;
    if (categorySlug) f.categorySlug = categorySlug;
    if (featuredOnly) f.featuredOnly = true;
    if (priceMin) f.priceMin = Number(priceMin);
    if (priceMax) f.priceMax = Number(priceMax);
    return f;
  }, [q, categorySlug, featuredOnly, priceMin, priceMax]);

  const [{ data, fetching, error }, reexec] = useQuery<ListingsPageResponse>({
    query: LISTINGS_PAGE,
    variables: { limit, offset, filters },
    requestPolicy: "cache-and-network",
  });

  useEffect(() => {
    reexec({ requestPolicy: "network-only" });
  }, [categorySlug, q, featuredOnly, priceMin, priceMax, reexec]);

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

  function clearAll() {
    setQInput("");
    setFeaturedOnly(false);
    setCategorySlug("");
    setPriceMin("");
    setPriceMax("");
  }

  const selectedCategoryName = useMemo(() => {
    if (!categorySlug) return "";
    return categories.find((c) => c.slug === categorySlug)?.name || categorySlug;
  }, [categorySlug, categories]);

  return (
    <SeasonalShell title="Makutanoni Marketplace" subtitle="Premium listings • Trusted sellers • Fast search">
      <>
        <MarketplaceHero />

        <Container sx={{ py: { xs: 3, md: 4 } }}>
          {/* Premium Search Panel */}
          <Box
            sx={{
              mb: 2.5,
              p: { xs: 2.25, md: 3 },
              borderRadius: 4,
              border: "1px solid rgba(244,246,248,0.10)",
              background:
                "radial-gradient(1200px 450px at 15% -10%, rgba(201,162,77,0.18), rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              boxShadow: "0 18px 65px rgba(0,0,0,0.35)",
            }}
          >
            <Stack spacing={1.2}>
              <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0.2, lineHeight: 1.1 }}>
                Find your next deal ✨
              </Typography>

              <Typography color="text.secondary">
                Browse categories • Filter fast • Save favorites • Buy with confidence
              </Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Search vehicles, houses, electronics…"
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

                  <Button
                    onClick={clearAll}
                    variant="text"
                    sx={{ whiteSpace: "nowrap", flex: { xs: 1, md: "none" } }}
                  >
                    Clear
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

              {/* ✅ Category Orbs */}
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                  <Typography sx={{ fontWeight: 950, color: "rgba(244,246,248,0.92)" }}>
                    Categories
                  </Typography>

                  {categorySlug ? (
                    <Chip
                      label={`Selected: ${selectedCategoryName}`}
                      onDelete={() => setCategorySlug("")}
                      sx={{
                        bgcolor: "rgba(201,162,77,0.12)",
                        border: "1px solid rgba(201,162,77,0.22)",
                        color: "rgba(244,246,248,0.92)",
                      }}
                    />
                  ) : (
                    <Chip
                      label="All categories"
                      onClick={() => setCategorySlug("")}
                      sx={{
                        bgcolor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(244,246,248,0.12)",
                      }}
                    />
                  )}
                </Stack>

                <Box
                  sx={{
                    mt: 1.2,
                    display: "flex",
                    gap: 1.5,
                    overflowX: "auto",
                    pb: 1,
                    "&::-webkit-scrollbar": { height: 8 },
                    "&::-webkit-scrollbar-thumb": {
                      backgroundColor: "rgba(244,246,248,0.18)",
                      borderRadius: 999,
                    },
                  }}
                >
                  {/* All */}
                  <CategoryOrb
                    cat={{ id: "all", name: "All", slug: "" }}
                    active={!categorySlug}
                    onClick={() => setCategorySlug("")}
                  />

                  {catsLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <Box
                          key={i}
                          sx={{
                            width: 118,
                            textAlign: "center",
                            opacity: 0.65,
                          }}
                        >
                          <Box
                            sx={{
                              width: 92,
                              height: 92,
                              mx: "auto",
                              borderRadius: 999,
                              border: "1px solid rgba(244,246,248,0.10)",
                              bgcolor: "rgba(255,255,255,0.05)",
                            }}
                          />
                          <Box
                            sx={{
                              mt: 1,
                              mx: "auto",
                              width: 72,
                              height: 10,
                              borderRadius: 999,
                              bgcolor: "rgba(255,255,255,0.06)",
                            }}
                          />
                        </Box>
                      ))
                    : categories.map((c) => (
                        <CategoryOrb
                          key={c.slug}
                          cat={c}
                          active={categorySlug === c.slug}
                          onClick={() => setCategorySlug(c.slug)}
                        />
                      ))}
                </Box>
              </Box>
            </Stack>
          </Box>

          {/* Filters panel */}
          {showFilters && (
            <Card sx={{ mb: 2.25, borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontWeight: 900 }}>Refine results</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={clearAll}>
                        Reset
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => reexec({ requestPolicy: "network-only" })}
                      >
                        Refresh
                      </Button>
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
                      gap: 12,
                    }}
                  >
                    <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 6" } }}>
                      <TextField
                        fullWidth
                        label="Price min"
                        value={priceMin}
                        onChange={(e) => setPriceMin(clampInt(e.target.value, 0))}
                        placeholder="5000"
                      />
                    </Box>

                    <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 6" } }}>
                      <TextField
                        fullWidth
                        label="Price max"
                        value={priceMax}
                        onChange={(e) => setPriceMax(clampInt(e.target.value, 0))}
                        placeholder="25000"
                      />
                    </Box>
                  </Box>

                  <Divider />

                  <Typography color="text.secondary">
                    Showing{" "}
                    <b style={{ color: "rgba(244,246,248,0.95)" }}>{items.length}</b> of{" "}
                    <b style={{ color: "rgba(244,246,248,0.95)" }}>{total}</b> listings
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )}

          {error && <Alert severity="error">{error.message}</Alert>}

          {/* Listings grid */}
          <Box
            sx={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(4, 1fr)",
              },
            }}
          >
            {(fetching ? Array.from({ length: 12 }) : items).map((it: any, idx: number) =>
              it ? (
                <ListingCard
                  key={it.id ?? idx}
                  item={it as Listing}
                  onOpen={() => nav(`/listing/${it.id}`)}
                  onToggleFav={() => onToggleFavorite(it.id)}
                />
              ) : (
                <Box
                  key={idx}
                  sx={{
                    height: 360,
                    borderRadius: 3,
                    border: "1px solid rgba(244,246,248,0.10)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  }}
                />
              )
            )}
          </Box>

          {/* Pagination */}
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
    </SeasonalShell>
  );
}
