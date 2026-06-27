# Mericet - Security Audit and Best Practices

## Overview

This document outlines the security strategy, audit procedures, and best practices for the Mericet platform to ensure data protection, privacy, and security compliance.

## Security Objectives

1. Protect user data and privacy
2. Prevent unauthorized access to systems and data
3. Ensure secure authentication and authorization
4. Protect against common web vulnerabilities (OWASP Top 10)
5. Maintain data integrity and availability
6. Comply with data protection regulations (GDPR, CCPA)
7. Implement security monitoring and incident response

## Security Architecture

### Defense in Depth Strategy

**Layer 1: Network Security**
- HTTPS/TLS encryption for all traffic
- CORS properly configured
- DDoS protection via Cloudflare
- Rate limiting on API endpoints

**Layer 2: Application Security**
- Input validation and sanitization
- Output encoding to prevent XSS
- Parameterized queries to prevent SQL injection
- CSRF protection
- Secure session management

**Layer 3: Authentication & Authorization**
- Multi-factor authentication support
- JWT token security
- Row Level Security (RLS) in database
- Principle of least privilege
- Regular token rotation

**Layer 4: Data Security**
- Data encryption at rest
- Data encryption in transit
- Secure password hashing (bcrypt)
- Sensitive data masking in logs
- Secure file upload handling

**Layer 5: Monitoring & Response**
- Security event logging
- Real-time threat detection
- Incident response procedures
- Regular security audits
- Penetration testing

## Authentication Security

### Password Requirements

**Password Policy:**
- Minimum 8 characters
- Must include: uppercase, lowercase, number, special character
- No common passwords (check against known breached passwords)
- Password history (cannot reuse last 5 passwords)
- Maximum age: 90 days (recommended for sensitive accounts)

**Implementation:**
```typescript
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain uppercase letter")
  .regex(/[a-z]/, "Password must contain lowercase letter")
  .regex(/[0-9]/, "Password must contain number")
  .regex(/[^A-Za-z0-9]/, "Password must contain special character");
```

### JWT Token Security

**Token Configuration:**
- Access token expiration: 1 hour
- Refresh token expiration: 7 days
- Secure, HttpOnly cookies for tokens
- Token rotation on refresh
- Token revocation on logout

**Token Storage:**
- Frontend: Secure, HttpOnly cookie (not localStorage)
- Backend: Encrypted in database
- Never expose tokens in URLs or logs

**Token Validation:**
```typescript
// Validate token signature
// Check expiration
// Verify issuer
// Check token revocation list
```

### OAuth Security

**OAuth Implementation:**
- Use authorization code flow (not implicit flow)
- Validate state parameter (CSRF protection)
- Verify redirect URIs
- Use PKCE for public clients
- Validate ID tokens from providers

**Supported Providers:**
- Google (OAuth 2.0)
- GitHub (OAuth 2.0)
- LinkedIn (OAuth 2.0)

### Multi-Factor Authentication (MFA)

**MFA Options:**
- SMS-based OTP (6 digits, 10-minute expiration)
- Email-based OTP
- Authenticator app (TOTP) - future enhancement

**MFA Flow:**
1. User enters credentials
2. System validates credentials
3. System sends OTP to user's verified method
4. User enters OTP
5. System validates OTP
6. Session created

## Authorization and Access Control

### Row Level Security (RLS)

**RLS Policies Required for All Tables:**

**Users Table:**
```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);
```

**Posts Table:**
```sql
-- Public posts visible to all authenticated users
CREATE POLICY "Public posts visible" ON posts
  FOR SELECT USING (
    visibility = 'public' AND is_published = true
  );

-- Connection posts visible to connections only
CREATE POLICY "Connection posts visible" ON posts
  FOR SELECT USING (
    visibility = 'connections' AND
    user_id IN (
      SELECT receiver_id FROM connections 
      WHERE requester_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT requester_id FROM connections 
      WHERE receiver_id = auth.uid() AND status = 'accepted'
    )
  );

-- Users can insert their own posts
CREATE POLICY "Users can create posts" ON posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update/delete their own posts
CREATE POLICY "Users can modify own posts" ON posts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (user_id = auth.uid());
```

**Messages Table:**
```sql
-- Users can only see messages in their conversations
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can send messages to their conversations
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants
      WHERE user_id = auth.uid()
    )
  );
```

### API Authorization

**Authorization Middleware:**
```typescript
// Require authentication
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Require specific permission
async function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

## Input Validation and Sanitization

### Frontend Validation

**Using Zod Schemas:**
```typescript
// User profile validation
const profileSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional()
});

// Post creation validation
const postSchema = z.object({
  content: z.string().min(1).max(2000),
  visibility: z.enum(['public', 'connections', 'private']),
  media: z.array(z.object({
    type: z.enum(['image', 'video']),
    url: z.string().url()
  })).optional()
});
```

### Backend Validation

**Server-side Validation (Never trust client):**
```typescript
// Validate and sanitize all inputs
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .slice(0, 2000); // Maximum length
}

// Example endpoint with validation
app.post('/posts', requireAuth, async (req, res) => {
  // Validate input
  const result = postSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  
  // Sanitize content
  const sanitized = sanitizeInput(result.data.content);
  
  // Process request...
});
```

### SQL Injection Prevention

**Always use parameterized queries:**
```typescript
// BAD - Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);
```

### XSS Prevention

**Output Encoding:**
```typescript
// React automatically escapes content
<div>{userInput}</div> // Safe

// For dangerouslySetInnerHTML, use DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
```

**Content Security Policy (CSP) Headers:**
```typescript
const cspHeader = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co",
    "frame-ancestors 'none'"
  ].join('; ')
};
```

## File Upload Security

### Upload Restrictions

**File Type Validation:**
```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

function validateFile(file: File, type: 'image' | 'video'): boolean {
  const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large');
  }
  
  return true;
}
```

**File Content Validation:**
- Verify file magic numbers (not just extension)
- Scan for malware (if budget allows)
- Strip EXIF data from images (privacy)
- Generate thumbnails server-side

**Storage Security:**
- Store uploads outside web root
- Use signed URLs for access
- Set appropriate permissions
- Implement virus scanning
- Regular cleanup of old files

## API Security

### Rate Limiting

**Rate Limit Configuration:**
```typescript
// By IP address
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

// By user (authenticated endpoints)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => req.user.id
});

// Stricter limits for sensitive endpoints
const authAttemptsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  skipSuccessfulRequests: true
});
```

**Endpoint-Specific Limits:**
- Authentication: 5 attempts per hour
- Post creation: 10 per hour
- Message sending: 50 per hour
- API calls: 100 per 15 minutes
- Search: 30 per minute

### CORS Configuration

**Proper CORS Setup:**
```typescript
const corsOptions = {
  origin: [
    'https://Mericet.example.com',
    'https://staging.Mericet.example.com',
    process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : ''
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### API Versioning

**Version in URL:**
- /api/v1/posts
- /api/v1/users
- Future: /api/v2/...

**Benefits:**
- Backward compatibility
- Gradual migration
- Deprecation strategy

## Data Protection

### Data Encryption

**Encryption at Rest:**
- Database encryption enabled (Supabase)
- File storage encryption (Supabase Storage)
- Backup encryption

**Encryption in Transit:**
- TLS 1.3 for all connections
- HTTPS enforced (redirect HTTP to HTTPS)
- Secure WebSocket (WSS) for real-time

**Sensitive Data Handling:**
```typescript
// Hash passwords
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);

// Encrypt sensitive data
import crypto from 'crypto';
function encrypt(text: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}
```

### Privacy Settings

**User Privacy Controls:**
- Email visibility (public/connections/private)
- Phone visibility (public/connections/private)
- Birthday visibility
- Location visibility
- Work history visibility
- Connections visibility
- Activity status visibility

**Privacy Enforcement:**
- RLS policies respect privacy settings
- API responses filtered based on settings
- Search results respect privacy
- Default to most private setting

### Data Retention

**Retention Policies:**
- Active user data: Retained indefinitely
- Deleted account data: 30-day grace period, then permanently deleted
- Logs: 90 days
- Backups: 30 days
- Analytics: Aggregated, anonymized after 1 year

**Right to be Forgotten:**
- User can request account deletion
- All personal data removed within 30 days
- Anonymize user content (posts become "Anonymous User")
- Remove from backups on next rotation

## Security Monitoring

### Logging Strategy

**What to Log:**
- Authentication attempts (success and failure)
- Authorization failures
- API requests and responses (without sensitive data)
- Database queries (slow queries)
- Error stack traces
- File uploads
- Account changes

**What NOT to Log:**
- Passwords (even hashed)
- Full credit card numbers
- API keys or secrets
- Personal identifiable information (PII) in plain text

**Log Levels:**
- ERROR: System errors, exceptions
- WARN: Potential issues, unusual activity
- INFO: Normal operations, successful actions
- DEBUG: Detailed debugging information (dev only)

### Security Event Monitoring

**Events to Monitor:**
- Multiple failed login attempts
- Suspicious API usage patterns
- Large file uploads
- Database query anomalies
- Unusual traffic spikes
- Geographic anomalies
- Privilege escalation attempts

**Alerting:**
- Critical: Immediate notification (SMS, phone)
- High: Email and Slack within 15 minutes
- Medium: Daily digest
- Low: Weekly report

### Intrusion Detection

**Indicators of Compromise:**
- Multiple 401/403 responses
- SQL injection attempts in logs
- XSS payload patterns
- Unusual access patterns
- Brute force attempts
- Port scanning

**Response Actions:**
- Automatic IP blocking (after threshold)
- Account temporary lockout
- Alert security team
- Log all details for investigation

## Vulnerability Management

### Dependency Scanning

**Automated Scanning:**
```bash
# npm audit
npm audit
npm audit fix

# Snyk
snyk test
snyk monitor

# Dependabot (GitHub)
# Automatically creates PRs for vulnerable dependencies
```

**Scanning Frequency:**
- On every pull request (CI/CD)
- Weekly full scan
- Immediate scan on new vulnerability disclosure

### Code Security Scanning

**Static Analysis:**
```bash
# ESLint with security plugins
eslint --ext .ts,.tsx src/

# SonarQube (if available)
sonar-scanner
```

**Security Linters:**
- eslint-plugin-security
- eslint-plugin-react-security
- no-unsafe-innerhtml

### Penetration Testing

**Testing Schedule:**
- Internal: Monthly
- External: Quarterly
- Pre-launch: Comprehensive audit
- Post-major release: Focused testing

**Testing Scope:**
- Authentication and authorization
- Input validation
- Business logic flaws
- API security
- Client-side security
- Infrastructure security

## Incident Response

### Incident Classification

**Severity Levels:**

**Critical (P0):**
- Data breach
- System compromised
- Unauthorized access to production data
- Complete service outage
- Response Time: Immediate

**High (P1):**
- Partial data exposure
- Authentication bypass
- Significant vulnerability discovered
- Service degradation
- Response Time: 1 hour

**Medium (P2):**
- XSS vulnerability
- Information disclosure
- Moderate service issues
- Response Time: 4 hours

**Low (P3):**
- Minor security issue
- No immediate risk
- Low-impact bugs
- Response Time: 24 hours

### Incident Response Process

**Step 1: Detection and Identification**
- Security monitoring detects anomaly
- Alert triggered
- On-call engineer notified

**Step 2: Containment**
- Isolate affected systems
- Block malicious traffic
- Preserve evidence
- Prevent further damage

**Step 3: Eradication**
- Identify root cause
- Remove threat
- Patch vulnerabilities
- Update security measures

**Step 4: Recovery**
- Restore systems
- Verify integrity
- Monitor closely
- Resume normal operations

**Step 5: Post-Incident**
- Document incident
- Conduct post-mortem
- Update procedures
- Implement preventive measures

### Communication During Incidents

**Internal Communication:**
- Immediate: Slack #critical-incidents channel
- Status updates: Every 30 minutes
- Incident commander leads communication

**External Communication:**
- If user data affected: Notify users within 24 hours
- Public status page update
- Email to affected users
- Social media update if necessary

**Regulatory Reporting:**
- GDPR: 72 hours to report data breach
- Other regulations as applicable

## Compliance and Regulations

### GDPR Compliance

**Requirements:**
- Data protection by design and default
- Lawful basis for processing
- Right to access (data export)
- Right to erasure (account deletion)
- Right to portability
- Consent management
- Data breach notification

**Implementation:**
- Privacy policy clearly stated
- Cookie consent banner
- Data export functionality
- Account deletion functionality
- Data processing agreements with vendors

### CCPA Compliance (California)

**Requirements:**
- Right to know what data is collected
- Right to delete personal information
- Right to opt-out of sale (N/A for networking platform)
- Non-discrimination

**Implementation:**
- Privacy policy disclosure
- Data deletion process
- Do Not Sell link (even if not selling)

## Security Audit Checklist

### Pre-Launch Security Audit

**Authentication & Authorization:**
- [ ] Password policy enforced
- [ ] JWT tokens secured
- [ ] OAuth implemented correctly
- [ ] MFA available
- [ ] Session management secure
- [ ] RLS policies on all tables
- [ ] API authorization checks

**Input Validation:**
- [ ] All inputs validated (client and server)
- [ ] SQL injection prevented
- [ ] XSS prevention implemented
- [ ] File upload validation
- [ ] Content Security Policy set

**Data Protection:**
- [ ] HTTPS enforced
- [ ] Data encrypted at rest
- [ ] Sensitive data not logged
- [ ] Privacy settings implemented
- [ ] Data retention policy defined

**API Security:**
- [ ] Rate limiting implemented
- [ ] CORS configured correctly
- [ ] API versioning in place
- [ ] Error messages don't leak information

**Monitoring:**
- [ ] Security logging enabled
- [ ] Alerts configured
- [ ] Incident response plan documented
- [ ] Backups automated and tested

**Compliance:**
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie policy published
- [ ] GDPR requirements met
- [ ] Data export functionality
- [ ] Account deletion functionality

**Dependency Security:**
- [ ] All dependencies up to date
- [ ] No known vulnerabilities (critical/high)
- [ ] License compliance checked

**Infrastructure:**
- [ ] Firewall configured
- [ ] DDoS protection enabled
- [ ] Database backups automated
- [ ] SSL/TLS certificates valid
- [ ] DNS security (DNSSEC)

## Security Training

### Developer Security Training

**Topics:**
- OWASP Top 10
- Secure coding practices
- Authentication and authorization
- Input validation
- SQL injection prevention
- XSS prevention
- CSRF protection
- Secure file handling
- API security

**Training Schedule:**
- Onboarding: 4 hours security training
- Quarterly: 1-hour refresher
- Ad-hoc: After security incidents

### Security Awareness

**All Team Members:**
- Phishing awareness
- Password security
- Social engineering
- Physical security
- Incident reporting

**Frequency:** Quarterly reminders

## Security Resources

**Documentation:**
- OWASP Top 10: https://owasp.org/Top10/
- Supabase Security: https://supabase.com/docs/guides/platform/security
- Web Security Academy: https://portswigger.net/web-security

**Tools:**
- Snyk: https://snyk.io
- OWASP ZAP: https://www.zaproxy.org/
- Burp Suite: https://portswigger.net/burp

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 20, 2026 | TBD | Initial security document |
