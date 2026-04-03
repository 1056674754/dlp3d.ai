'use client'

import { Box, Button, Container, Typography } from '@mui/material'
import { navigateInPackagedWebview } from '@/utils/packagedWebview'

export default function DebugPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h5" component="h1">
          Debug / Logs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Lightweight entry point. Use Chrome remote debugging or your preferred
          tools to inspect the embedded WebView.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigateInPackagedWebview('/')}
          sx={{ alignSelf: 'flex-start' }}
        >
          Back to app
        </Button>
      </Box>
    </Container>
  )
}
