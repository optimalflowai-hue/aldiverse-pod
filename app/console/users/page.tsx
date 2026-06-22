'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { supabaseClient } from '@/lib/supabase-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Check, 
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Share2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ProfileItem {
  id: string;
  email: string;
  role: 'superadmin' | 'member';
  deleted_at: string | null;
  updated_at: string;
  password?: string;
}

export default function UserManagementConsole() {
  const { role, user: loggedUser } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<'superadmin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);

  const [editingProfile, setEditingProfile] = useState<ProfileItem | null>(null);
  const [sharingProfile, setSharingProfile] = useState<{ profile: ProfileItem; tempPassword?: string } | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [deletingProfile, setDeletingProfile] = useState<ProfileItem | null>(null);

  const handleOpenShare = (profile: ProfileItem, tempPassword?: string) => {
    setSharePassword(tempPassword || '');
    setSharingProfile({ profile, tempPassword });
  };

  // Protect route client-side: Only superadmin can access
  useEffect(() => {
    if (role && role !== 'superadmin') {
      router.push('/console');
    }
  }, [role, router]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch('/api/v1/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.profiles) {
        setProfiles(data.profiles);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load team profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'superadmin') {
      loadProfiles();
    }
  }, [role]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      if (editingProfile) {
        // Edit User
        const payload: any = {
          role: newRole,
        };
        if (username.trim()) {
          payload.username = username.trim();
        }
        if (password) {
          payload.password = password;
        }

        const res = await fetch(`/api/v1/users/${editingProfile.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update user');
        }

        toast.success('Team member updated successfully!');
        const updatedProfile = data.profile || {
          ...editingProfile,
          email: username.trim().includes('@') ? username.trim() : `${username.trim().toLowerCase()}@aldiverse.com`,
          role: newRole
        };
        
        // Show share credentials dialog if password was updated
        if (password) {
          handleOpenShare(updatedProfile, password);
        }
      } else {
        // Create User
        const finalEmail = username.trim().includes('@')
          ? username.trim()
          : `${username.trim().toLowerCase()}@aldiverse.com`;

        const res = await fetch('/api/v1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: finalEmail, password, role: newRole })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create user');
        }

        toast.success('Team member registered successfully!');
        
        // Always open share credentials dialog for new user
        handleOpenShare(data.profile, password);
      }

      setUsername('');
      setPassword('');
      setNewRole('member');
      setEditingProfile(null);
      setShowAddForm(false);
      await loadProfiles();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (id: string, currentRole: 'superadmin' | 'member') => {
    const targetRole = currentRole === 'superadmin' ? 'member' : 'superadmin';
    if (!window.confirm(`Are you sure you want to change this user's role to ${targetRole}?`)) {
      return;
    }

    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`/api/v1/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: targetRole })
      });

      if (res.ok) {
        toast.success('User role updated successfully');
        await loadProfiles();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update user role');
      }
    } catch (e) {
      console.error(e);
      toast.error('An unexpected error occurred');
    }
  };

  const handleSoftDelete = async (id: string) => {
    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`/api/v1/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        toast.success('User disabled successfully');
        await loadProfiles();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to disable user');
      }
    } catch (e) {
      console.error(e);
      toast.error('An unexpected error occurred');
    }
  };

  const handleRestoreUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to restore and re-enable this team member?')) {
      return;
    }

    try {
      const session = await supabaseClient.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`/api/v1/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ restore: true })
      });

      if (res.ok) {
        toast.success('User re-enabled successfully');
        await loadProfiles();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to restore user');
      }
    } catch (e) {
      console.error(e);
      toast.error('An unexpected error occurred');
    }
  };

  if (role !== 'superadmin') {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">User Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage roles, promote team members, and toggle portal accessibility.
          </p>
        </div>
        
        <button
          onClick={() => {
            setEditingProfile(null);
            setUsername('');
            setPassword('');
            setNewRole('member');
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 h-9 bg-primary text-primary-foreground font-semibold rounded-md transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add New Member</span>
        </button>
      </div>

      {/* Add/Edit User Dialog Overlay */}
      <AnimatePresence>
        {showAddForm && (
          <div 
            onClick={() => setShowAddForm(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground w-full max-w-md rounded-lg border shadow-lg p-6 space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  {editingProfile ? (
                    <Pencil className="h-4.5 w-4.5 text-primary" />
                  ) : (
                    <UserPlus className="h-4.5 w-4.5 text-primary" />
                  )}
                  <h3 className="font-bold text-sm uppercase tracking-wider">
                    {editingProfile ? 'Edit Team Member' : 'Register Team Member'}
                  </h3>
                </div>
                <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {editingProfile ? 'New Password (leave blank to keep current)' : 'Initial Password'}
                  </label>
                  <input
                    type="text"
                    required={!editingProfile}
                    placeholder="e.g. MySecurePassword123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-md border bg-background text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="member">member</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-md flex items-center justify-center transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm mt-2"
                >
                  {submitting ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : editingProfile ? (
                    'Save Changes'
                  ) : (
                    'Add Member'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share User Dialog Overlay */}
      <AnimatePresence>
        {sharingProfile && (
          <div 
            onClick={() => setSharingProfile(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground w-full max-w-md rounded-lg border shadow-lg p-6 space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Share2 className="h-4.5 w-4.5 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Share Credentials</h3>
                </div>
                <button onClick={() => setSharingProfile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Username</label>
                  <input
                    type="text"
                    readOnly
                    value={sharingProfile.profile.email.split('@')[0]}
                    className="w-full h-10 px-3 rounded-md border bg-muted text-foreground text-sm outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Password</label>
                  <input
                    type="text"
                    readOnly
                    value={sharePassword}
                    placeholder="No password saved. Edit user to set one."
                    className="w-full h-10 px-3 rounded-md border bg-muted text-foreground text-sm outline-none font-mono"
                  />
                </div>

                <div className="space-y-1 bg-muted p-3 rounded-md border text-[10px] space-y-1 leading-relaxed">
                  <span className="font-bold text-muted-foreground uppercase tracking-wider text-[9px] block">Preview Message</span>
                  <p className="font-mono whitespace-pre-wrap select-all bg-background p-2 rounded border">
                    {`your credentials:\nUsername: ${sharingProfile.profile.email.split('@')[0]}\nPassword: ${sharePassword || '<No password saved. Edit user to set one.>'}\nlogin from: ${typeof window !== 'undefined' ? `${window.location.origin}/login` : ''}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!sharePassword) {
                      toast.error('No password is set for this user. Please edit the user to set a password first.');
                      return;
                    }
                    const loginLink = typeof window !== 'undefined' ? `${window.location.origin}/login` : '';
                    const message = `your credentials:\nUsername: ${sharingProfile.profile.email.split('@')[0]}\nPassword: ${sharePassword}\nlogin from: ${loginLink}`;
                    try {
                      await navigator.clipboard.writeText(message);
                      toast.success('Credentials copied to clipboard!');
                    } catch (err) {
                      toast.error('Failed to copy to clipboard');
                    }
                  }}
                  className="flex-1 h-10 bg-primary text-primary-foreground font-semibold rounded-md flex items-center justify-center transition-all hover:opacity-90 active:scale-[0.98] text-xs shadow-sm"
                >
                  Copy Credentials
                </button>
                <button
                  onClick={() => setSharingProfile(null)}
                  className="px-4 h-10 border bg-background text-foreground hover:bg-muted font-semibold rounded-md transition-all text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete User Confirmation Dialog */}
      <AnimatePresence>
        {deletingProfile && (
          <div 
            onClick={() => setDeletingProfile(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground w-full max-sm rounded-lg border shadow-lg p-6 space-y-4 relative"
            >
              <div className="flex items-center gap-2.5 text-destructive border-b pb-3">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Disable User</h3>
              </div>

              <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Are you sure you want to disable <strong>@{deletingProfile.email.split('@')[0]}</strong>?
                </p>
                <p>
                  They will lose all access to the Aldiverse platform immediately. You can restore access later if needed.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    const id = deletingProfile.id;
                    setDeletingProfile(null);
                    await handleSoftDelete(id);
                  }}
                  className="flex-1 h-10 bg-destructive text-destructive-foreground font-semibold rounded-md flex items-center justify-center transition-all hover:bg-destructive/95 active:scale-[0.98] text-xs shadow-sm"
                >
                  Disable Account
                </button>
                <button
                  onClick={() => setDeletingProfile(null)}
                  className="px-4 h-10 border bg-background text-foreground hover:bg-muted font-semibold rounded-md transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Users list table */}
      <div className="border rounded-lg bg-card text-card-foreground p-6 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b animate-pulse last:border-0">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="h-5 w-16 bg-muted rounded mx-4" />
                <div className="h-5 w-14 bg-muted rounded mx-4" />
                <div className="h-8 w-24 bg-muted rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="group hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 px-3">
                      <p className="font-bold text-xs">{profile.email.split('@')[0]}</p>
                      <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{profile.email} • ID: {profile.id}</p>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        profile.role === 'superadmin'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {profile.role === 'superadmin' ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        {profile.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {profile.deleted_at ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-semibold">
                          <AlertCircle className="h-3.5 w-3.5" /> Disabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          <Check className="h-3.5 w-3.5" /> Active
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenShare(profile, profile.password)}
                        title="Share Credentials"
                        className="inline-flex items-center justify-center h-8 w-8 rounded border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>

                      {loggedUser?.id !== profile.id && (
                        <>
                          <button
                            onClick={() => {
                              setEditingProfile(profile);
                              setUsername(profile.email.split('@')[0]);
                              setPassword(profile.password || '');
                              setNewRole(profile.role);
                              setShowAddForm(true);
                            }}
                            title="Edit User"
                            className="inline-flex items-center justify-center h-8 w-8 rounded border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {profile.deleted_at ? (
                            <button
                              onClick={() => handleRestoreUser(profile.id)}
                              title="Restore User"
                              className="inline-flex items-center justify-center h-8 w-8 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setDeletingProfile(profile)}
                              title="Disable User"
                              className="inline-flex items-center justify-center h-8 w-8 rounded bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
