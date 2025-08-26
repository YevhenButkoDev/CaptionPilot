import { createTheme } from "@mui/material";

const theme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#0f0f0f',
            paper: '#1a1a1a',
        },
        divider: '#2a2a2a',
        text: {
            primary: '#ffffff',
            secondary: '#dddddd',
        },
        primary: {
            main: '#2a2a2a',
            contrastText: '#ffffff',
        },
        error: {
            main: '#f44336',
        },
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #2a2a2a',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                contained: {
                    backgroundColor: '#c44949',
                    color: '#ffffff',
                    '&:hover': { backgroundColor: '#c13232' },
                },
                outlined: {
                    borderColor: '#c44949',
                    color: '#ffffff',
                    '&:hover': { borderColor: '#c13232', backgroundColor: '#c13232' },
                },
            },
        },
    },
});


export default theme;