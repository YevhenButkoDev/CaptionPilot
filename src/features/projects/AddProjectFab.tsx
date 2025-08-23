import * as React from "react";
import Fab from "@mui/material/Fab";
import { useTheme } from "@mui/material/styles";
import NewProjectDialog from "./NewProjectDialog";

export default function AddProjectFab({ onSaved }: { onSaved?: (id: string) => void }) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Fab
        color="primary"
        aria-label="create-project"
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
      <NewProjectDialog
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
