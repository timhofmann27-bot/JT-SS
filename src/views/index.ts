import { lazy } from 'react';

export const HomeView = lazy(() => import('./HomeView'));
export const SearchView = lazy(() => import('./SearchView'));
export const LibraryView = lazy(() => import('./LibraryView'));
export const LikedSongsView = lazy(() => import('./LikedSongsView'));
export const AlbumDetailView = lazy(() => import('./AlbumDetailView'));
export const ArtistDetailView = lazy(() => import('./ArtistDetailView'));
export const PlaylistDetailView = lazy(() => import('./PlaylistDetailView'));
export const ProfileView = lazy(() => import('./ProfileView'));
