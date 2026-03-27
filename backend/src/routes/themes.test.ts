/**
 * Themes API Tests (TDD - Task 4.4)
 * Testes escritos ANTES da implementação
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Themes API', () => {
  describe('GET /api/admin/themes', () => {
    it('deve listar temas do tenant', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes', {
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('themes');
      expect(Array.isArray(data.themes)).toBe(true);
    });

    it('deve retornar 401 sem autenticação', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/themes/:id', () => {
    it('deve retornar tema específico', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/theme-1', {
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('primary_color');
      expect(data).toHaveProperty('layout_style');
    });

    it('deve retornar 404 para tema inexistente', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/invalid', {
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/admin/themes', () => {
    it('deve criar novo tema', async () => {
      const newTheme = {
        name: 'Dark Theme',
        description: 'Tema escuro moderno',
        primary_color: '#ff6b00',
        secondary_color: '#1a1a1a',
        background_color: '#000000',
        text_color: '#ffffff',
        layout_style: 'grid'
      };

      const response = await fetch('http://localhost:8787/api/admin/themes', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTheme)
      });
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Dark Theme');
      expect(data.primary_color).toBe('#ff6b00');
    });

    it('deve validar cores (formato hex)', async () => {
      const invalidTheme = {
        name: 'Invalid Theme',
        primary_color: 'red', // inválido
        layout_style: 'grid'
      };

      const response = await fetch('http://localhost:8787/api/admin/themes', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidTheme)
      });
      
      expect(response.status).toBe(400);
    });

    it('deve validar layout_style', async () => {
      const invalidTheme = {
        name: 'Invalid Layout',
        layout_style: 'invalid' // deve ser grid, list ou masonry
      };

      const response = await fetch('http://localhost:8787/api/admin/themes', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidTheme)
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/admin/themes/:id', () => {
    it('deve atualizar tema existente', async () => {
      const updates = {
        primary_color: '#00ff00',
        layout_style: 'masonry'
      };

      const response = await fetch('http://localhost:8787/api/admin/themes/theme-1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.primary_color).toBe('#00ff00');
      expect(data.layout_style).toBe('masonry');
    });

    it('deve criar nova versão ao atualizar', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/theme-1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ primary_color: '#ff0000' })
      });
      
      const data = await response.json();
      expect(data.version).toBeGreaterThan(1);
      expect(data.parent_version_id).toBeDefined();
    });
  });

  describe('POST /api/admin/themes/:id/activate', () => {
    it('deve ativar tema', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/theme-2/activate', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.is_active).toBe(1);
    });

    it('deve desativar tema anterior ao ativar novo', async () => {
      // Ativar theme-2
      await fetch('http://localhost:8787/api/admin/themes/theme-2/activate', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });

      // Verificar que apenas theme-2 está ativo
      const listResponse = await fetch('http://localhost:8787/api/admin/themes', {
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      const data = await listResponse.json();
      const activeThemes = data.themes.filter((t: any) => t.is_active === 1);
      expect(activeThemes.length).toBe(1);
      expect(activeThemes[0].id).toBe('theme-2');
    });
  });

  describe('POST /api/admin/themes/:id/rollback', () => {
    it('deve fazer rollback para versão anterior', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/theme-1/rollback', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.version).toBeGreaterThan(1);
    });

    it('deve retornar 400 se não houver versão anterior', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/theme-first/rollback', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/public/theme', () => {
    it('deve retornar tema ativo do tenant (público)', async () => {
      const response = await fetch('http://localhost:8787/api/public/theme', {
        headers: {
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.is_active).toBe(1);
      expect(data).toHaveProperty('primary_color');
      expect(data).not.toHaveProperty('custom_css'); // não expor CSS customizado no público
    });

    it('deve retornar tema padrão se nenhum ativo', async () => {
      const response = await fetch('http://localhost:8787/api/public/theme', {
        headers: {
          'X-Tenant-ID': 'tenant-new'
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.primary_color).toBe('#ff6b00'); // cor padrão
    });
  });

  describe('DELETE /api/admin/themes/:id', () => {
    it('deve deletar tema inativo', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/theme-inactive', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(204);
    });

    it('deve retornar 400 ao tentar deletar tema ativo', async () => {
      const response = await fetch('http://localhost:8787/api/admin/themes/theme-active', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin-token',
          'X-Tenant-ID': 'tenant-1'
        }
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('ativo');
    });
  });
});
