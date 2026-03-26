// Type definitions for database entities
// These types are used across the application

export interface User {
  id: string;
  email: string;
  password: string;
  tenantId: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
}

export interface Video {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  views: number;
  createdAt: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface VideoCategory {
  videoId: string;
  categoryId: string;
}

export interface VideoTag {
  videoId: string;
  tagId: string;
}
