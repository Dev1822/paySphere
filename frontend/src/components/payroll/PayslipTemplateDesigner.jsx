import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PayslipPreviewModal from './PayslipPreviewModal';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const DEFAULT_SECTIONS = [
  { id: 'header', title: 'Header', order: 0, visible: true },
  { id: 'employeeDetails', title: 'Employee Details', order: 1, visible: true },
  { id: 'earnings', title: 'Earnings', order: 2, visible: true },
  { id: 'deductions', title: 'Deductions', order: 3, visible: true },
  { id: 'netPay', title: 'Net Pay', order: 4, visible: true },
  { id: 'footer', title: 'Footer', order: 5, visible: true },
];

const PayslipTemplateDesigner = () => {
  const [template, setTemplate] = useState({
    branding: { primaryColor: '#3b82f6', logoUrl: '', fontFamily: 'Helvetica' },
    sections: DEFAULT_SECTIONS,
    footerOptions: { showQrCode: false, customText: '' },
    security: { passwordStrategy: 'NONE' },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
    try {
      const res = await axios.get('/api/payslip-templates');
      if (res.data && Object.keys(res.data).length > 0) {
        setTemplate({
          branding: res.data.branding || {
            primaryColor: '#3b82f6',
            logoUrl: '',
            fontFamily: 'Helvetica',
          },
          sections:
            res.data.sections?.length > 0
              ? res.data.sections
              : DEFAULT_SECTIONS,
          footerOptions: res.data.footerOptions || {
            showQrCode: false,
            customText: '',
          },
          security: res.data.security || { passwordStrategy: 'NONE' },
        });
      }
    } catch (err) {
      console.error('Failed to load template', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put('/api/payslip-templates', template);
      alert('Template saved successfully');
    } catch (err) {
      console.error('Failed to save', err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(template.sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }));
    setTemplate({ ...template, sections: updatedItems });
  };

  const toggleSectionVisibility = (index) => {
    const newSections = [...template.sections];
    newSections[index].visible = !newSections[index].visible;
    setTemplate({ ...template, sections: newSections });
  };

  if (loading) return <div className="p-8">Loading designer...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Payslip Template Designer</h1>
        <div className="space-x-4">
          <button
            onClick={() => setPreviewOpen(true)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Branding & Settings */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <h2 className="text-lg font-semibold mb-4">Branding</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Primary Color
                </label>
                <input
                  type="color"
                  value={template.branding.primaryColor}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      branding: {
                        ...template.branding,
                        primaryColor: e.target.value,
                      },
                    })
                  }
                  className="h-10 w-20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={template.branding.logoUrl}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      branding: {
                        ...template.branding,
                        logoUrl: e.target.value,
                      },
                    })
                  }
                  className="w-full border p-2 rounded"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <h2 className="text-lg font-semibold mb-4">
              Security & Verification
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  PDF Password Protection
                </label>
                <select
                  value={template.security.passwordStrategy}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      security: {
                        ...template.security,
                        passwordStrategy: e.target.value,
                      },
                    })
                  }
                  className="w-full border p-2 rounded"
                >
                  <option value="NONE">None</option>
                  <option value="DOB">Date of Birth (DDMMYYYY)</option>
                  <option value="PAN">PAN Number</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={template.footerOptions.showQrCode}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      footerOptions: {
                        ...template.footerOptions,
                        showQrCode: e.target.checked,
                      },
                    })
                  }
                  id="showQrCode"
                />
                <label htmlFor="showQrCode">Include QR Code Verification</label>
              </div>
            </div>
          </div>
        </div>

        {/* Section Ordering */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-lg font-semibold mb-4">
            Section Layout (Drag to reorder)
          </h2>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sections">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {template.sections.map((item, index) => (
                    <Draggable
                      key={item.id}
                      draggableId={item.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="flex items-center justify-between p-3 bg-gray-50 border rounded"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-400 cursor-grab">
                              ⋮⋮
                            </span>
                            <span
                              className={
                                item.visible ? '' : 'text-gray-400 line-through'
                              }
                            >
                              {item.title}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleSectionVisibility(index)}
                            className={`text-sm px-2 py-1 rounded ${item.visible ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}
                          >
                            {item.visible ? 'Visible' : 'Hidden'}
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      <PayslipPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        templateData={template}
      />
    </div>
  );
};

export default PayslipTemplateDesigner;
