// src/pages/ListingDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "urql";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";

import { useAuth } from "../contexts/AuthContext";
import { toAbsUrl } from "../lib/media";

/* ============================
   GraphQL
============================ */

const LISTING_Q = `
query Listing($id: ID!) {
  listing(listingId: $id) {
    id
    title
    price
    currency
    year
    make
    model
    trim
    mileage
    fuelType
    transmission
    bodyType
    color
    vin
    description
    city
    region
    country
    isFavorited
    viewsCount
    dealer {
      id
      dealershipName
      phone
      whatsapp
      city
      region
      country
    }
    images {
      id
      imageUrl
      thumbnailUrl
      isCover
      sortOrder
    }
  }
}
`;

const INC_VIEW = `
mutation Inc($id: ID!) {
  incrementListingView(listingId: $id)
}
`;

const TOGGLE_FAV = `
mutation Fav($id: ID!) {
  toggleFavorite(listingId: $id)
}
`;

/* ============================
   Helpers (safe)
============================ */

function safeAbsUrl(url?: string | null) {
  if (!url) return "";
  try {
    return toAbsUrl(url);
  } catch {
    return url;
  }
}

function formatMoney(rawValue: any, rawCurrency?: any) {
  const value = Number(rawValue);
  const currency =
    typeof rawCurrency === "string" && rawCurrency.trim()
      ? rawCurrency.trim().toUpperCase()
      : "USD";

  if (!Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // fallback if currency code is invalid
    return `$${value.toLocaleString("en-US")}`;
  }
}

function firstNonEmpty(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return "—";
}

/* ============================
   Component
============================ */

export default function ListingDetailPage() {
  const params = useParams();
  // support either /listing/:id or /listing/:listingId
  const id = (params as any)?.id || (params as any)?.listingId;

  const navigate = useNavigate();
  const { isAuthed } = useAuth();

  if (!id) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="warning">
          Missing listing id in the URL. Check your route like <b>/listing/:id</b>.
        </Alert>
      </Container>
    );
  }

  const [{ data, fetching, error }, refetch] = useQuery({
    query: LISTING_Q,
    variables: { id },
    requestPolicy: "cache-and-network",
  });

  const [, incView] = useMutation(INC_VIEW);
  const [, toggleFav] = useMutation(TOGGLE_FAV);

  const listing = data?.listing;

  /* ============================
     View counter (side-effect)
     Only once per listing id
  ============================ */
  useEffect(() => {
    if (listing?.id) {
      incView({ id: listing.id }).catch(() => {});
    }
  }, [listing?.id, incView]);

  /* ============================
     Images
  ============================ */
  const images = useMemo(() => {
    const arr = listing?.images ?? [];
    return [...arr].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [listing?.images]);

  const coverImage = useMemo(() => {
    return images.find((img: any) => img.isCover) || images[0];
  }, [images]);

  const [activeImage, setActiveImage] = useState<string>("");

  useEffect(() => {
    const next = coverImage?.imageUrl || "";
    setActiveImage(next);
  }, [coverImage?.imageUrl]);

  /* ============================
     Actions
  ============================ */
  async function handleFavorite() {
    if (!listing?.id) return;
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    try {
      await toggleFav({ id: listing.id });
      refetch({ requestPolicy: "network-only" });
    } catch {
      // ignore; error will show if urql surfaces it
    }
  }

  /* ============================
     Loading / empty states
  ============================ */
  if (!fetching && !error && !listing) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="info">Listing not found.</Alert>
      </Container>
    );
  }

  /* ============================
     Render
  ============================ */
  return (
    <Container sx={{ py: { xs: 3, md: 5 } }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* =======================
            IMAGE GALLERY
        ======================= */}
        <Grid item xs={12} md={7}>
          <Card sx={{ overflow: "hidden" }}>
            <Box sx={{ position: "relative" }}>
              {fetching && !listing ? (
                <Skeleton variant="rectangular" height={420} />
              ) : (
                <Box
                  component="img"
                  src={activeImage ? safeAbsUrl(activeImage) : safeAbsUrl(coverImage?.imageUrl)}
                  alt={listing?.title || "Listing image"}
                  sx={{
                    width: "100%",
                    height: { xs: 260, md: 420 },
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}

              <IconButton
                onClick={handleFavorite}
                aria-label="favorite listing"
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  bgcolor: "rgba(0,0,0,.55)",
                  border: "1px solid rgba(255,255,255,.12)",
                  "&:hover": { bgcolor: "rgba(0,0,0,.75)" },
                }}
              >
                {listing?.isFavorited ? (
                  <FavoriteRoundedIcon color="primary" />
                ) : (
                  <FavoriteBorderRoundedIcon />
                )}
              </IconButton>
            </Box>

            {/* Thumbnails */}
            <Box sx={{ p: 1.5 }}>
              <Grid container spacing={1}>
                {(fetching && !listing ? Array.from({ length: 8 }) : images.slice(0, 8)).map(
                  (img: any, idx: number) => {
                    if (fetching && !listing) {
                      return (
                        <Grid item xs={3} sm={2} key={idx}>
                          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1.5 }} />
                        </Grid>
                      );
                    }

                    const thumb = safeAbsUrl(img.thumbnailUrl || img.imageUrl);
                    const isActive = activeImage === img.imageUrl;

                    return (
                      <Grid item xs={3} sm={2} key={img.id}>
                        <Box
                          component="img"
                          src={thumb}
                          alt=""
                          onClick={() => setActiveImage(img.imageUrl)}
                          sx={{
                            width: "100%",
                            height: 72,
                            objectFit: "cover",
                            borderRadius: 1.5,
                            cursor: "pointer",
                            border: isActive ? "2px solid" : "1px solid",
                            borderColor: isActive ? "primary.main" : "divider",
                            opacity: isActive ? 1 : 0.8,
                            "&:hover": { opacity: 1 },
                          }}
                        />
                      </Grid>
                    );
                  }
                )}
              </Grid>
            </Box>
          </Card>
        </Grid>

        {/* =======================
            DETAILS
        ======================= */}
        <Grid item xs={12} md={5}>
          <Stack spacing={2.5}>
            {/* Header */}
            <Box>
              {fetching && !listing ? (
                <>
                  <Skeleton width="80%" height={36} />
                  <Skeleton width="55%" height={28} sx={{ mt: 1 }} />
                </>
              ) : (
                <>
                  <Typography variant="h5" fontWeight={900}>
                    {listing?.title || "—"}
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
                    {listing?.year && <Chip size="small" label={listing.year} />}
                    {(listing?.make || listing?.model) && (
                      <Chip size="small" label={`${listing?.make ?? ""} ${listing?.model ?? ""}`.trim()} />
                    )}
                    {listing?.transmission && <Chip size="small" label={listing.transmission} />}
                    {listing?.fuelType && <Chip size="small" label={listing.fuelType} />}
                  </Stack>
                </>
              )}
            </Box>

            {/* Price */}
            <Typography sx={{ color: "primary.main", fontWeight: 900, fontSize: 26 }}>
              {formatMoney(listing?.price, listing?.currency)}
            </Typography>

            {/* Dealer */}
            <Card>
              <CardContent>
                <Typography fontWeight={800}>Dealer</Typography>

                <Typography color="text.secondary" mt={0.5}>
                  {firstNonEmpty(listing?.dealer?.dealershipName, "Private Seller")}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="body2">
                  {firstNonEmpty(listing?.dealer?.city, listing?.city)} •{" "}
                  {firstNonEmpty(listing?.dealer?.region, listing?.region)}
                </Typography>

                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Phone: {firstNonEmpty(listing?.dealer?.phone)} <br />
                  WhatsApp: {firstNonEmpty(listing?.dealer?.whatsapp)}
                </Typography>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardContent>
                <Typography fontWeight={800}>Description</Typography>
                <Typography color="text.secondary" mt={1} whiteSpace="pre-wrap">
                  {listing?.description || "No description provided."}
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
