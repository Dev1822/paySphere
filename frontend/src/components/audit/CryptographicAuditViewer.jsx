import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  AlertTitle,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import GppBadIcon from '@mui/icons-material/GppBad';
import LockIcon from '@mui/icons-material/Lock';
import axios from 'axios';

// Since @mui/lab might not be installed, we use a simple custom timeline or basic Box structure
const TimelineItem = ({ item, isLast, isBroken }) => {
  return (
    <Box sx={{ display: 'flex', mb: isLast ? 0 : 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mr: 2,
        }}
      >
        {item.valid && !isBroken ? (
          <LockIcon color="success" />
        ) : (
          <GppBadIcon color="error" />
        )}
        {!isLast && (
          <Box
            sx={{
              width: 2,
              flexGrow: 1,
              bgcolor: isBroken ? 'error.main' : 'success.main',
              my: 0.5,
              borderStyle: isBroken ? 'dashed' : 'solid',
            }}
          />
        )}
      </Box>
      <Box sx={{ flexGrow: 1, pb: 2 }}>
        <Paper
          elevation={1}
          sx={{
            p: 2,
            borderLeft: '4px solid',
            borderColor:
              item.valid && !isBroken ? 'success.main' : 'error.main',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {new Date(item.timestamp).toLocaleString()}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
            >
              <strong>Hash:</strong> {item.hash}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                color: 'text.secondary',
              }}
            >
              <strong>Prev:</strong> {item.previousHash}
            </Typography>
          </Box>
          {!item.valid && item.note && (
            <Typography
              variant="body2"
              color="error"
              sx={{ mt: 1, fontWeight: 'bold' }}
            >
              {item.note}
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

const CryptographicAuditViewer = ({ modelName, documentId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAuditChain = async () => {
      try {
        setLoading(true);
        // Uses the current origin (e.g. proxy through vite) or the appropriate API endpoint
        const response = await axios.get(
          `/api/audit-logs/verify/${modelName}/${documentId}`,
          {
            withCredentials: true,
          },
        );
        setData(response.data.data || response.data);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            'Failed to verify cryptographic chain',
        );
      } finally {
        setLoading(false);
      }
    };

    if (modelName && documentId) {
      fetchAuditChain();
    }
  }, [modelName, documentId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data || !data.history || data.history.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No cryptographic seals found for this record.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Cryptographic Ledger
        </Typography>
        {data.valid ? (
          <Chip
            icon={<VerifiedUserIcon />}
            label="Cryptographically Sealed"
            color="success"
            variant="outlined"
          />
        ) : (
          <Chip
            icon={<GppBadIcon />}
            label="Tampering Detected"
            color="error"
            variant="filled"
          />
        )}
      </Box>

      {!data.valid && (
        <Alert severity="error" variant="filled" sx={{ mb: 3 }}>
          <AlertTitle>
            Critical Security Alert: Immutable Chain Broken
          </AlertTitle>
          The cryptographic verification failed at index {data.brokenAt}. This
          indicates that historical data was altered or the database was
          directly tampered with, bypassing application integrity controls.
        </Alert>
      )}

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight="500">Seal History Timeline</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mt: 1 }}>
            {data.history.map((item, index) => {
              // If the chain is broken, all items after the broken point are considered suspect/broken visually
              const isBroken = !data.valid && index >= data.brokenAt;
              return (
                <TimelineItem
                  key={index}
                  item={item}
                  isLast={index === data.history.length - 1}
                  isBroken={isBroken}
                />
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default CryptographicAuditViewer;
