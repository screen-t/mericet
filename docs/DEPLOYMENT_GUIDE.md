# Deployment Guide for Stonet

## Prerequisites
- Supabase project created with database migrations applied
- Vercel account
- Render account

## Backend Deployment (Render)

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Connect to Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the `backend` folder as Root Directory

### 3. Configure Environment Variables
Add these in Render dashboard under "Environment":

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
FRONTEND_URL=https://your-app.vercel.app
BACKEND_URL=https://your-backend.onrender.com
```

### 4. Build Settings
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Python Version**: 3.11

### 5. Deploy
Click "Create Web Service" and wait for deployment.

---

## Frontend Deployment (Vercel)

### 1. Connect to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Select the `frontend` folder as Root Directory

### 2. Configure Environment Variables
Add these in Vercel dashboard under "Settings" → "Environment Variables":

```
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Build Settings (Auto-detected by Vercel)
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4. Deploy
Click "Deploy" and wait for build to complete.

---

## Post-Deployment Configuration

### 1. Update Backend CORS
After deploying frontend, update `FRONTEND_URL` environment variable in Render with your actual Vercel URL:
```
FRONTEND_URL=https://your-app.vercel.app
```
Redeploy the backend after changing this.

### 2. Update OAuth Redirect URLs in Supabase
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add these URLs to "Redirect URLs":
   ```
   https://your-backend.onrender.com/auth/oauth/callback
   https://your-app.vercel.app/auth/callback
   ```

### 3. Test OAuth Providers
If using Google/GitHub/LinkedIn OAuth:
1. Update redirect URIs in each provider's console
2. Add production URLs:
   - Google Cloud Console
   - GitHub OAuth Apps
   - LinkedIn Developers

---

## Environment Variables Reference

### Backend (.env)
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
FRONTEND_URL=https://your-app.vercel.app
BACKEND_URL=https://your-backend.onrender.com
```

### Frontend (.env.local)
```env
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

##  Health Checks

### Backend Health Check
```bash
curl https://your-backend.onrender.com/health
# Should return: {"status": "healthy"}
```

### Frontend Health Check
Visit `https://your-app.vercel.app` in browser

---

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` is set correctly in Render
- Check backend logs for CORS-related errors
- Verify the frontend URL matches exactly (no trailing slash)

### OAuth Not Working
- Check redirect URLs in Supabase dashboard
- Verify OAuth provider settings (Google/GitHub/LinkedIn)
- Ensure `BACKEND_URL` is set correctly

### Database Connection Issues
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Check Supabase project is not paused
- Review Row Level Security policies

### Build Failures
**Backend:**
- Check Python version (should be 3.11)
- Verify all dependencies in `requirements.txt`

**Frontend:**
- Check Node version (should be 18+)
- Clear build cache in Vercel if needed
- Verify all environment variables are set

---

## Performance Optimization (Post-Launch)

1. **Enable Vercel Edge Functions** for faster API routes
2. **Add CDN** for media files (Cloudflare R2 or AWS S3)
3. **Database Indexing** - Review query performance in Supabase
4. **Caching** - Implement Redis for frequently accessed data
5. **Monitoring** - Set up error tracking (Sentry, LogRocket)

---

## Security Checklist

- [ ] All environment variables are set and secure
- [ ] Supabase RLS policies are enabled
- [ ] No API keys in source code
- [ ] HTTPS enforced on both frontend and backend
- [ ] OAuth redirect URLs are production URLs only
- [ ] Rate limiting configured (if needed)
- [ ] CORS only allows your frontend domain

---

## Monitoring

### Render Logs
View backend logs in Render Dashboard → your service → Logs

### Vercel Logs
View frontend logs in Vercel Dashboard → your project → Deployments → select deployment → Build Logs

### Supabase Logs
View database queries in Supabase Dashboard → Logs

---

## Rollback Strategy

### Backend Rollback
1. Go to Render Dashboard → your service → Deploys
2. Click "Rollback" on previous working deployment

### Frontend Rollback
1. Go to Vercel Dashboard → your project → Deployments
2. Click "..." menu on previous working deployment → "Promote to Production"

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review deployment logs in Render/Vercel
3. Check Supabase logs for database errors
4. Verify all environment variables are set correctly
