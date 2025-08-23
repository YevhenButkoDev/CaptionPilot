import * as React from "react";
import Fab from "@mui/material/Fab";
import { useTheme } from "@mui/material/styles";
import NewPostDialog from "./NewPostDialog";

export default function AddPostFab({ onSaved }: { onSaved?: (id: string) => void }) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Fab
        color="primary"
        aria-label="create-post"
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
      <NewPostDialog
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


