import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordStrength } from '@/components/ui/PasswordStrength'
import { Shield, Eye, EyeOff, CheckCircle } from 'lucide-react'

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  // Supabase puts the access_token in the URL hash after redirect (e.g. #access_token=...&type=recovery)
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const token = hashParams.get('access_token') || searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordsMatch, setPasswordsMatch] = useState(false)

  // Validate that passwords match
  useEffect(() => {
    setPasswordsMatch(password === confirm && password.length > 0)
  }, [password, confirm])

  // Redirect to login if no token
  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      await (await import('../lib/api')).authApi.resetPassword({ 
        access_token: token, 
        new_password: password 
      })
      setMessage('Password updated successfully! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4"
          >
            <Shield className="h-6 w-6 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-muted-foreground mt-2">
            Create a strong password to secure your account
          </p>
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sm">
          {message ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-4"
            >
              <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">Password updated!</h3>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && <PasswordStrength password={password} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm your new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={`pr-10 ${
                      confirm && (passwordsMatch ? 'border-green-300' : 'border-red-300')
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirm && !passwordsMatch && (
                  <p className="text-sm text-red-600">Passwords do not match</p>
                )}
                {confirm && passwordsMatch && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Passwords match
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !passwordsMatch || password.length < 8}
              >
                {loading ? 'Updating password...' : 'Update password'}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Remember your password? Sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPassword
