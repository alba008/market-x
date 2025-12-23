import { useEffect, useMemo, useState } from "react";
import { useQuery } from "urql";
import {
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Typography,
  Skeleton,
} from "@mui/material";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useNavigate } from "react-router-dom";

const GOLD = "#C9A24D";
const TEXT = "rgba(244,246,248,.96)";
const DIM = "rgba(244,246,248,.70)";
const BORDER = "rgba(244,246,248,.12)";

const HERO_FEATURED_V2 = `
query HeroFeaturedV2($limit: Int!, $offset: Int!, $filters: ListingsV2FilterInput) {
  listingsPageV2(pagination:{limit:$limit, offset:$offset}, filters: $filters) {
    totalCount
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
      category { name slug }
      images { thumbnailUrl imageUrl isCover sortOrder }
    }
  }
}
`;

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

function resolveMediaUrl(raw?: string | null) {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;

  const explicitBase =
    (import.meta as any).env?.VITE_MEDIA_BASE_URL ||
    (import.meta as any).env?.VITE_BACKEND_URL ||
    "";

  if (explicitBase) {
    return `${String(explicitBase).replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
  }

  const gql = String((import.meta as any).env?.VITE_GRAPHQL_URL || "").trim();
  if (gql) {
    const base = gql.replace(/\/graphql\/?$/i, "");
    if (base && /^https?:\/\//i.test(base)) {
      return `${base.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
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
  return resolveMediaUrl(cover?.thumbnailUrl || cover?.imageUrl || "");
}

export default function MarketplaceHero() {
  const nav = useNavigate();

  // rotation index
  const [i, setI] = useState(0);

  const variables = useMemo(
    () => ({ limit: 10, offset: 0, filters: { featuredOnly: true } }),
    []
  );

  // ✅ IMPORTANT: always get fresh data so admin changes reflect
  const [{ data, fetching }] = useQuery({
    query: HERO_FEATURED_V2,
    variables,
    requestPolicy: "network-only",
    pollInterval: 8000, // refresh every 8s (great for dev/admin edits)
  });

  const featured = data?.listingsPageV2?.results ?? [];

  // ✅ reset index safely when the list changes (prevents "weird first item" / stuck)
  useEffect(() => {
    setI(0);
  }, [featured.map((x: any) => x?.id).join("|")]);

  // ✅ rotate only if we have 2+ items
  useEffect(() => {
    if (featured.length <= 1) return;
    const t = setInterval(() => {
      setI((x) => (x + 1) % featured.length);
    }, 4500);
    return () => clearInterval(t);
  }, [featured.length]);

  const active = featured.length ? featured[Math.min(i, featured.length - 1)] : null;
  const heroImg = active ? pickCoverImage(active.images) : "";
  const categoryName = active?.category?.name || "Featured";
  const location = [active?.city, active?.region, active?.country].filter(Boolean).join(", ");

  return (
    <Box
      sx={{
        position: "relative",
        borderBottom: `1px solid ${BORDER}`,
        overflow: "hidden",
        bgcolor: "#1A1F27",
      }}
    >
      {/* background image */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: heroImg ? `url("${heroImg}")` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: "scale(1.02)",
        }}
      />

      {/* overlay */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(1200px 600px at 20% 20%, rgba(201,162,77,.22), transparent 55%)," +
            "linear-gradient(90deg, rgba(0,0,0,.74) 0%, rgba(0,0,0,.52) 45%, rgba(0,0,0,.22) 100%)," +
            "linear-gradient(180deg, rgba(0,0,0,.30) 0%, rgba(0,0,0,.55) 100%)",
        }}
      />

      <Container sx={{ position: "relative", py: { xs: 4, md: 6 } }}>
        <Stack spacing={2.1} sx={{ maxWidth: 900 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }} useFlexGap>
            <Chip
              icon={<LocalFireDepartmentRoundedIcon fontSize="small" />}
              label="Featured placements"
              size="small"
              sx={{
                bgcolor: "rgba(201,162,77,.18)",
                border: "1px solid rgba(201,162,77,.24)",
                color: TEXT,
                ".MuiChip-icon": { color: GOLD },
              }}
            />
            <Typography sx={{ color: DIM, fontSize: 13 }}>
              Paid listings get the hero spotlight • All categories
            </Typography>
          </Stack>

          <Typography
            variant="h3"
            sx={{
              color: TEXT,
              fontWeight: 950,
              lineHeight: 1.05,
              letterSpacing: 0.2,
              fontSize: { xs: 32, sm: 40, md: 46 },
            }}
          >
            {fetching && !featured.length ? (
              <Skeleton width={420} />
            ) : active ? (
              active.title
            ) : (
              "Discover premium listings"
            )}
          </Typography>

          <Typography sx={{ color: DIM, maxWidth: 760 }}>
            {active ? (
              <>
                <b style={{ color: TEXT }}>{categoryName}</b>
                {location ? ` • ${location}` : ""} • {money(active.price, active.currency)}
              </>
            ) : (
              "Your multi-category marketplace. Mark a listing as Featured to appear here."
            )}
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
            <Button
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => nav("/marketplace-v2")}
              sx={{
                bgcolor: "rgba(201,162,77,.22)",
                color: TEXT,
                borderRadius: 3,
                px: 2.2,
                "&:hover": { bgcolor: "rgba(201,162,77,.28)" },
              }}
            >
              Browse marketplace
            </Button>

            {active ? (
              <Button
                variant="outlined"
                onClick={() => nav(`/m/v2/${active.slug}`)}
                sx={{
                  borderColor: "rgba(244,246,248,.18)",
                  color: TEXT,
                  borderRadius: 3,
                  px: 2.2,
                }}
              >
                View featured item
              </Button>
            ) : null}
          </Stack>

          {/* thumbnails */}
          {featured.length > 1 ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }} useFlexGap>
              {featured.slice(0, 7).map((x: any, idx: number) => (
                <Box
                  key={x.id}
                  onClick={() => setI(idx)}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 34,
                      borderRadius: 2,
                      border: `1px solid ${
                        idx === i ? "rgba(201,162,77,.55)" : "rgba(244,246,248,.14)"
                      }`,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,.06)",
                      backgroundImage: `url("${pickCoverImage(x.images)}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      opacity: idx === i ? 1 : 0.75,
                      transition: "opacity .15s ease, transform .15s ease, border-color .15s ease",
                      "&:hover": { opacity: 1, transform: "translateY(-1px)" },
                    }}
                  />
                </Box>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
