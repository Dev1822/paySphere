import React, { useState, useMemo } from 'react';
import { List } from 'react-window';
import {
  Box,
  Checkbox,
  TextField,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  InputAdornment,
} from '@mui/material';
import { Search } from 'lucide-react';

const EmployeeMultiSelect = ({ employees, selectedIds, onSelectionChange }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = useMemo(() => {
    return employees.filter(
      (emp) =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [employees, searchTerm]);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      onSelectionChange(filteredEmployees.map((e) => e._id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const isAllSelected =
    filteredEmployees.length > 0 &&
    selectedIds.length === filteredEmployees.length;
  const isIndeterminate =
    selectedIds.length > 0 && selectedIds.length < filteredEmployees.length;

  const Row = ({ index, style }) => {
    const employee = filteredEmployees[index];
    const isSelected = selectedIds.includes(employee._id);

    return (
      <div
        style={style}
        className="flex border-b border-gray-100 dark:border-gray-800 items-center"
      >
        <Box sx={{ width: 50, display: 'flex', justifyContent: 'center' }}>
          <Checkbox
            checked={isSelected}
            onChange={() => handleSelectOne(employee._id)}
          />
        </Box>
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="body2">{employee.fullName}</Typography>
        </Box>
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="body2" color="textSecondary">
            {employee.role}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, px: 2 }}>
          <Typography variant="body2" color="textSecondary">
            {employee.department || '—'}
          </Typography>
        </Box>
      </div>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
      }}
    >
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Paper
        variant="outlined"
        sx={{
          flexGrow: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2 font-medium">
          <Box sx={{ width: 50, display: 'flex', justifyContent: 'center' }}>
            <Checkbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onChange={handleSelectAll}
            />
          </Box>
          <Box sx={{ flex: 1, px: 2, display: 'flex', alignItems: 'center' }}>
            Name
          </Box>
          <Box sx={{ flex: 1, px: 2, display: 'flex', alignItems: 'center' }}>
            Role
          </Box>
          <Box sx={{ flex: 1, px: 2, display: 'flex', alignItems: 'center' }}>
            Department
          </Box>
        </div>

        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {filteredEmployees.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="textSecondary">No employees found.</Typography>
            </Box>
          ) : (
            <List
              height={400}
              itemCount={filteredEmployees.length}
              itemSize={48}
              width="100%"
            >
              {Row}
            </List>
          )}
        </Box>
      </Paper>

      <Box
        sx={{
          mt: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" color="textSecondary">
          {selectedIds.length} selected of {filteredEmployees.length} available
        </Typography>
      </Box>
    </Box>
  );
};

export default EmployeeMultiSelect;
