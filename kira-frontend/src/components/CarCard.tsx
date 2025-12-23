import { Card, CardActionArea, CardContent, CardMedia, Chip, Stack, Typography, IconButton, Box } from "@mui/material";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { toAbsUrl } from "../lib/media";

type Img = { thumbnailUrl?: string | null; imageUrl?: string | null; isCover?: boolean | null };
type Dealer = { dealershipName?: string | null; city?: string | null; region?: string | null };
export type Listing = {
  id: string;
  title: string;
  price: string;
  year: number;
  make: string;
  model: string;
  city?: string | null;
  region?: string | null;
  images: Img[];
  dealer: Dealer;
  isFavorited?: boolean | null;
};

export function CarCard({
  item,
  onOpen,
  onToggleFav,
  favLoading,
}: {
  item: Listing;
  onOpen: () => void;
  onToggleFav?: () => void;
  favLoading?: boolean;
}) {
  const cover = item.images?.find((i) => i.isCover) || item.images?.[0];
  const img = toAbsUrl(cover?.thumbnailUrl || cover?.imageUrl || "");

  return (
    <Card
      sx={{
        overflow: "hidden",
        transition: "transform .15s ease, box-shadow .15s ease",
        "&:hover": { transform: "translateY(-3px)" },
      }}
    >
      <CardActionArea onClick={onOpen}>
        <Box sx={{ position: "relative" }}>
          <CardMedia component="img" height={190} image={img || undefined} alt={item.title} sx={{ objectFit: "cover" }} />
          <Chip
            label={`${item.year} • ${item.make} ${item.model}`}
            size="small"
            sx={{
              position: "absolute",
              left: 10,
              top: 10,
              bgcolor: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          />
          {onToggleFav && (
            <IconButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFav();
              }}
              disabled={favLoading}
              sx={{
                position: "absolute",
                right: 8,
                top: 8,
                bgcolor: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.10)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.60)" },
              }}
            >
              {item.isFavorited ? <FavoriteRoundedIcon color="primary" /> : <FavoriteBorderRoundedIcon />}
            </IconButton>
          )}
        </Box>

        <CardContent>
          <Stack spacing={0.6}>
            <Typography sx={{ fontWeight: 800 }} noWrap>
              {item.title}
            </Typography>

            <Typography sx={{ color: "primary.main", fontWeight: 900, letterSpacing: 0.2 }}>
              ${Number(item.price).toLocaleString()}
            </Typography>

            <Typography variant="body2" color="text.secondary" noWrap>
              {item.city || item.dealer?.city || "—"} • {item.region || item.dealer?.region || "—"}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
