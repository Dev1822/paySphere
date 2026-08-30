import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper,
  Alert,
} from '@mui/material';

export default function AdjudicationWorkspace() {
  const [claims, setClaims] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      // Assuming a standard token auth
      const token = localStorage.getItem('token');
      const response = await fetch('/api/expenses/claims/fraud', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Fallback to empty array if claims is not in response
        setClaims(data.claims || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch claims', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (status) => {
    if (!selectedClaim) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/expenses/claims/${selectedClaim._id}/adjudicate`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status, rejectionReason }),
        },
      );

      if (response.ok) {
        setActionSuccess(`Claim ${status} successfully!`);
        setSelectedClaim(null);
        setRejectionReason('');
        fetchClaims();
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        alert('Action failed.');
      }
    } catch (err) {
      console.error('Failed to adjudicate', err);
    }
  };

  return (
    <Box
      sx={{ p: 3, height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <Typography variant="h4" gutterBottom>
        Fraud & Expense Adjudication Workspace
      </Typography>

      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {actionSuccess}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {/* Left Side: Claim Selection List */}
        <Grid item xs={3} sx={{ height: '100%', overflowY: 'auto' }}>
          <Paper elevation={3} sx={{ height: '100%' }}>
            <Typography variant="h6" sx={{ p: 2 }}>
              Pending Audit
            </Typography>
            <Divider />
            <List>
              {loading ? (
                <ListItem>
                  <ListItemText primary="Loading claims..." />
                </ListItem>
              ) : claims.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No claims pending audit." />
                </ListItem>
              ) : (
                claims.map((claim) => (
                  <ListItem
                    button
                    key={claim._id}
                    selected={selectedClaim?._id === claim._id}
                    onClick={() => {
                      setSelectedClaim(claim);
                      setRejectionReason('');
                    }}
                  >
                    <ListItemText
                      primary={`${claim.description || claim.category} - ${claim.currency} ${claim.amount}`}
                      secondary={`Risk Score: ${claim.fraudRiskScore || 0}`}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        {/* Right Side: Split Pane for Document and Details */}
        <Grid
          item
          xs={9}
          sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          {selectedClaim ? (
            <Grid container spacing={2} sx={{ height: '100%' }}>
              {/* Document Viewer Pane */}
              <Grid item xs={6} sx={{ height: '100%' }}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent
                    sx={{
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Receipt Viewer
                    </Typography>
                    <Box
                      sx={{
                        flexGrow: 1,
                        backgroundColor: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      {selectedClaim.receipts &&
                      selectedClaim.receipts.length > 0 ? (
                        <img
                          src={selectedClaim.receipts[0].url}
                          alt="Receipt"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      ) : (
                        <Typography color="textSecondary">
                          No Receipt Provided
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Data & Decision Pane */}
              <Grid item xs={6} sx={{ height: '100%' }}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ overflowY: 'auto', flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      Adjudication Details
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Risk Score:
                      </Typography>
                      <Chip
                        label={selectedClaim.fraudRiskScore || 0}
                        color={
                          (selectedClaim.fraudRiskScore || 0) > 50
                            ? 'error'
                            : 'warning'
                        }
                        size="large"
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Policy Violations:
                      </Typography>
                      {selectedClaim.policyViolations &&
                      selectedClaim.policyViolations.length > 0 ? (
                        <List dense>
                          {selectedClaim.policyViolations.map(
                            (violation, i) => (
                              <ListItem key={i}>
                                <Alert severity="error" sx={{ width: '100%' }}>
                                  {violation}
                                </Alert>
                              </ListItem>
                            ),
                          )}
                        </List>
                      ) : (
                        <Typography color="textSecondary">None</Typography>
                      )}
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        OCR Extracted Data:
                      </Typography>
                      {selectedClaim.ocrMetadata ? (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="body2">
                            Amount:{' '}
                            {selectedClaim.ocrMetadata.extractedAmount || 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            Date:{' '}
                            {selectedClaim.ocrMetadata.extractedDate
                              ? new Date(
                                  selectedClaim.ocrMetadata.extractedDate,
                                ).toLocaleDateString()
                              : 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            Currency:{' '}
                            {selectedClaim.ocrMetadata.extractedCurrency ||
                              'N/A'}
                          </Typography>
                        </Paper>
                      ) : (
                        <Typography color="textSecondary">
                          No OCR Data Available
                        </Typography>
                      )}
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography
                      variant="subtitle1"
                      fontWeight="bold"
                      gutterBottom
                    >
                      Decision
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Comments / Rejection Reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      sx={{ mb: 2 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        color="success"
                        onClick={() => handleAction('approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => handleAction('needs_info')}
                      >
                        Request Info
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        onClick={() => handleAction('rejected')}
                      >
                        Reject
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography variant="h5" color="textSecondary">
                Select a claim to adjudicate
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
