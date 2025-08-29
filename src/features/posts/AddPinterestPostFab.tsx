import * as React from "react";
import Fab from "@mui/material/Fab";
import { useTheme } from "@mui/material/styles";
import NewPinterestPostDialog from "./NewPinterestPostDialog";

export default function AddPinterestPostFab({ onSaved }: { onSaved?: (id: string) => void }) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Fab
        color="primary"
        aria-label="create-pinterest-post"
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: (theme.zIndex.modal || 1300) + 1,
        }}
      >
        +
      </Fab>
      <NewPinterestPostDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(id) => {
          setOpen(false);
          onSaved?.(id);
        }}
      />
    </>
  );
}
