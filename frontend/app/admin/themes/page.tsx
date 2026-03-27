'use client';

/**
 * Theme Editor - Admin Dashboard
 * Task 4.4: Editor visual de temas com preview em tempo real
 */

import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface Theme {
  id?: string;
  tenant_id?: string;
  name: string;
  description?: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  accent_color: string;
  logo_url?: string;
  favicon_url?: string;
  font_family: string;
  font_size_base: string;
  layout_style: 'grid' | 'list' | 'masonry';
  grid_columns: number;
  card_border_radius: string;
  custom_css?: string;
  is_active?: number;
  version?: number;
  parent_version_id?: string;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_THEME: Theme = {
  name: 'New Theme',
  description: '',
  primary_color: '#ff6b00',
  secondary_color: '#1a1a1a',
  background_color: '#ffffff',
  text_color: '#000000',
  accent_color: '#ff8c00',
  font_family: 'Inter, system-ui, sans-serif',
  font_size_base: '16px',
  layout_style: 'grid',
  grid_columns: 4,
  card_border_radius: '8px',
};

export default function ThemeEditorPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTheme, setCurrentTheme] = useState<Theme>(DEFAULT_THEME);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carregar temas
  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      const response = await fetch('/api/admin/themes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': localStorage.getItem('tenantId') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes);
      }
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  };

  const handleSaveTheme = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const url = selectedThemeId
        ? `/api/admin/themes/${selectedThemeId}`
        : '/api/admin/themes';
      
      const method = selectedThemeId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': localStorage.getItem('tenantId') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentTheme),
      });

      if (response.ok) {
        const savedTheme = await response.json();
        setMessage({ type: 'success', text: 'Theme saved successfully!' });
        loadThemes();
        setSelectedThemeId(savedTheme.id);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save theme' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateTheme = async (themeId: string) => {
    try {
      const response = await fetch(`/api/admin/themes/${themeId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': localStorage.getItem('tenantId') || '',
        },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Theme activated!' });
        loadThemes();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to activate theme' });
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    if (!confirm('Are you sure you want to delete this theme?')) return;

    try {
      const response = await fetch(`/api/admin/themes/${themeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': localStorage.getItem('tenantId') || '',
        },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Theme deleted!' });
        loadThemes();
        if (selectedThemeId === themeId) {
          setCurrentTheme(DEFAULT_THEME);
          setSelectedThemeId(null);
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to delete theme' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete theme' });
    }
  };

  const handleLoadTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    setSelectedThemeId(theme.id || null);
  };

  const handleNewTheme = () => {
    setCurrentTheme(DEFAULT_THEME);
    setSelectedThemeId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Theme Editor</h1>

        {message && (
          <div
            className={`mb-4 p-4 rounded ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Lista de Temas */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Your Themes</h2>
                <button
                  onClick={handleNewTheme}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  New
                </button>
              </div>

              <div className="space-y-2">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`p-3 rounded border cursor-pointer ${
                      selectedThemeId === theme.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleLoadTheme(theme)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{theme.name}</h3>
                        {theme.is_active === 1 && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {theme.is_active !== 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateTheme(theme.id!);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Activate
                          </button>
                        )}
                        {theme.is_active !== 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTheme(theme.id!);
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Theme Name</label>
                  <input
                    type="text"
                    value={currentTheme.name}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={currentTheme.description}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Colors</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'primary_color', label: 'Primary Color' },
                  { key: 'secondary_color', label: 'Secondary Color' },
                  { key: 'background_color', label: 'Background Color' },
                  { key: 'text_color', label: 'Text Color' },
                  { key: 'accent_color', label: 'Accent Color' },
                ].map(({ key, label }) => (
                  <div key={key} className="relative">
                    <label className="block text-sm font-medium mb-1">{label}</label>
                    <div className="flex gap-2">
                      <div
                        className="w-12 h-10 rounded border cursor-pointer"
                        style={{ backgroundColor: currentTheme[key as keyof Theme] as string }}
                        onClick={() => setActiveColorPicker(activeColorPicker === key ? null : key)}
                      />
                      <input
                        type="text"
                        value={currentTheme[key as keyof Theme] as string}
                        onChange={(e) => setCurrentTheme({ ...currentTheme, [key]: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded font-mono text-sm"
                      />
                    </div>
                    {activeColorPicker === key && (
                      <div className="absolute z-10 mt-2">
                        <HexColorPicker
                          color={currentTheme[key as keyof Theme] as string}
                          onChange={(color) => setCurrentTheme({ ...currentTheme, [key]: color })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Layout */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Layout</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Layout Style</label>
                  <select
                    value={currentTheme.layout_style}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, layout_style: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                    <option value="masonry">Masonry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Grid Columns</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={currentTheme.grid_columns}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, grid_columns: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Card Border Radius</label>
                  <input
                    type="text"
                    value={currentTheme.card_border_radius}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, card_border_radius: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="8px"
                  />
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Typography</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Font Family</label>
                  <input
                    type="text"
                    value={currentTheme.font_family}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, font_family: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Base Font Size</label>
                  <input
                    type="text"
                    value={currentTheme.font_size_base}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, font_size_base: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="16px"
                  />
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Branding</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={currentTheme.logo_url || ''}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, logo_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Favicon URL</label>
                  <input
                    type="text"
                    value={currentTheme.favicon_url || ''}
                    onChange={(e) => setCurrentTheme({ ...currentTheme, favicon_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveTheme}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Theme'}
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
          <div
            className="p-8 rounded"
            style={{
              backgroundColor: currentTheme.background_color,
              color: currentTheme.text_color,
              fontFamily: currentTheme.font_family,
              fontSize: currentTheme.font_size_base,
            }}
          >
            <h3
              className="text-2xl font-bold mb-4"
              style={{ color: currentTheme.primary_color }}
            >
              Sample Heading
            </h3>
            <p className="mb-4">
              This is a preview of your theme. The text you're reading uses the configured colors
              and typography.
            </p>
            <div
              className={`grid gap-4 ${
                currentTheme.layout_style === 'grid'
                  ? `grid-cols-${currentTheme.grid_columns}`
                  : currentTheme.layout_style === 'list'
                  ? 'grid-cols-1'
                  : 'grid-cols-3'
              }`}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-4 border"
                  style={{
                    borderRadius: currentTheme.card_border_radius,
                    borderColor: currentTheme.secondary_color,
                    backgroundColor: currentTheme.background_color,
                  }}
                >
                  <div className="aspect-video bg-gray-200 mb-2 rounded" />
                  <h4
                    className="font-semibold"
                    style={{ color: currentTheme.text_color }}
                  >
                    Sample Video {i}
                  </h4>
                  <p
                    className="text-sm"
                    style={{ color: currentTheme.accent_color }}
                  >
                    100K views
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
