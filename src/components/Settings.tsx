import * as React from "react";
import {
  Box,
  Typography,
  TextField,
  Paper,
  Button,
  Alert,
  Snackbar,
  IconButton,
  InputAdornment
} from "@mui/material";
import { Visibility, VisibilityOff, Save, Refresh } from "@mui/icons-material";


interface SettingsData {
  openaiSecretKey: string;
  instagramUserToken: string;
  instagramUserId: string;
  cloudinaryApiKey: string;
}



export default function Settings() {
  const [settings, setSettings] = React.useState<SettingsData>({
    openaiSecretKey: "",
    instagramUserToken: "",
    instagramUserId: "",
    cloudinaryApiKey: "",
  });

  const [showPasswords, setShowPasswords] = React.useState<{
    openai: boolean;
    instagram: boolean;
    cloudinary: boolean;
  }>({
    openai: false,
    instagram: false,
    cloudinary: false,
  });

  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);



  React.useEffect(() => {
    loadSettings();
  }, []);



  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem("app-settings");
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      setError("Failed to load saved settings");
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem("app-settings", JSON.stringify(settings));
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setError("Failed to save settings");
    }
  };

  const handleInputChange = (field: keyof SettingsData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSettings(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const resetToDefaults = () => {
    setSettings({
      openaiSecretKey: "",
      instagramUserToken: "",
      instagramUserId: "",
      cloudinaryApiKey: "",
    });
    setError(null);
  };



  const handleCloseSnackbar = () => {
    setSaved(false);
    setError(null);
  };

  return (
    <Box sx={{ width: 1000, mx: "auto", p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold" }}>
        Settings
      </Typography>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: "600" }}>
            API Configuration
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<Refresh />} onClick={resetToDefaults} size="small">Reset</Button>
            <Button variant="contained" startIcon={<Save />} onClick={saveSettings} size="small">Save Settings</Button>
          </Box>
        </Box>

        <Box sx={{ display: "grid", gap: 3 }}>
          <TextField fullWidth label="OpenAI Secret Key" type={showPasswords.openai ? "text" : "password"} value={settings.openaiSecretKey} onChange={handleInputChange("openaiSecretKey")} placeholder="sk-..." helperText="Your OpenAI API key for AI-powered features" InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => togglePasswordVisibility("openai")} edge="end">{showPasswords.openai ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>) }} />
          <TextField fullWidth label="Instagram User Token" type={showPasswords.instagram ? "text" : "password"} value={settings.instagramUserToken} onChange={handleInputChange("instagramUserToken")} placeholder="IGQ..." helperText="Your Instagram user access token" InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => togglePasswordVisibility("instagram")} edge="end">{showPasswords.instagram ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>) }} />
          <TextField fullWidth label="Instagram User ID" type="text" value={settings.instagramUserId} onChange={handleInputChange("instagramUserId")} placeholder="123456789" helperText="Your Instagram user ID (numeric)" />
          <TextField fullWidth label="Cloudinary API Key" type={showPasswords.cloudinary ? "text" : "password"} value={settings.cloudinaryApiKey} onChange={handleInputChange("cloudinaryApiKey")} placeholder="123456789012345" helperText="Your Cloudinary API key for image management" InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton onClick={() => togglePasswordVisibility("cloudinary")} edge="end">{showPasswords.cloudinary ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>) }} />
        </Box>
      </Paper>



      <Snackbar open={saved} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: "100%" }}>
          Settings saved successfully!
        </Alert>
      </Snackbar>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
