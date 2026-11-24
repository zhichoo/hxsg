#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <math.h>
#import <stdint.h>
#import <stdlib.h>
#import <string.h>

typedef struct { uint8_t r, g, b, a; } RGBA;

static inline RGBA rgba_hex(uint32_t hex, uint8_t a) {
    RGBA c = { (uint8_t)((hex >> 16) & 0xFF), (uint8_t)((hex >> 8) & 0xFF), (uint8_t)(hex & 0xFF), a };
    return c;
}
static inline RGBA rgb(uint32_t hex) { return rgba_hex(hex, 255); }
static inline CGColorRef cg_color(RGBA c) {
    CGFloat comps[4] = { c.r / 255.0, c.g / 255.0, c.b / 255.0, c.a / 255.0 };
    CGColorSpaceRef cs = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGColorRef col = CGColorCreate(cs, comps);
    CGColorSpaceRelease(cs);
    return col;
}

static NSString *gOutRoot;
static NSString *gRawDir;
static NSString *gCc0Dir;
static NSString *gIconOut;

static void save_cgimage(CGImageRef img, NSString *fullPath) {
    if (!img) return;
    NSURL *url = [NSURL fileURLWithPath:fullPath];
    CGImageDestinationRef dest = CGImageDestinationCreateWithURL((__bridge CFURLRef)url, (__bridge CFStringRef)UTTypePNG.identifier, 1, NULL);
    if (!dest) { fprintf(stderr, "Failed dest: %s\n", fullPath.UTF8String); return; }
    CGImageDestinationAddImage(dest, img, NULL);
    CGImageDestinationFinalize(dest);
    CFRelease(dest);
}

static CGImageRef load_cgimage(NSString *fullPath) {
    NSURL *url = [NSURL fileURLWithPath:fullPath];
    CGImageSourceRef src = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
    if (!src) return NULL;
    CGImageRef img = CGImageSourceCreateImageAtIndex(src, 0, NULL);
    CFRelease(src);
    return img;
}

static CGContextRef create_ctx(int w, int h) {
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGContextRef ctx = CGBitmapContextCreate(NULL, w, h, 8, w * 4, cs, kCGImageAlphaPremultipliedLast);
    CGColorSpaceRelease(cs);
    CGContextSetAllowsAntialiasing(ctx, true);
    CGContextSetShouldAntialias(ctx, true);
    return ctx;
}

static void draw_gradient(CGContextRef ctx, CGRect rect, RGBA top, RGBA mid, RGBA bot, bool useMid) {
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGColorRef c1 = cg_color(top), c2 = cg_color(mid), c3 = cg_color(bot);
    NSArray *colors = useMid ? @[(__bridge id)c1, (__bridge id)c2, (__bridge id)c3] : @[(__bridge id)c1, (__bridge id)c3];
    CGFloat locs3[3] = {0.0, 0.5, 1.0};
    CGFloat locs2[2] = {0.0, 1.0};
    CGGradientRef grad = CGGradientCreateWithColors(cs, (__bridge CFArrayRef)colors, useMid ? locs3 : locs2);
    CGContextSaveGState(ctx);
    CGContextClipToRect(ctx, rect);
    CGContextDrawLinearGradient(ctx, grad, CGPointMake(CGRectGetMidX(rect), CGRectGetMaxY(rect)), CGPointMake(CGRectGetMidX(rect), CGRectGetMinY(rect)), 0);
    CGContextRestoreGState(ctx);
    CGGradientRelease(grad);
    CGColorRelease(c1); CGColorRelease(c2); CGColorRelease(c3);
    CGColorSpaceRelease(cs);
}

static void draw_radial_glow(CGContextRef ctx, CGPoint center, CGFloat radius, RGBA inner, RGBA outer) {
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGColorRef c1 = cg_color(inner), c2 = cg_color(outer);
    NSArray *colors = @[(__bridge id)c1, (__bridge id)c2];
    CGFloat locs[2] = {0.0, 1.0};
    CGGradientRef grad = CGGradientCreateWithColors(cs, (__bridge CFArrayRef)colors, locs);
    CGContextDrawRadialGradient(ctx, grad, center, 0, center, radius, 0);
    CGGradientRelease(grad);
    CGColorRelease(c1); CGColorRelease(c2);
    CGColorSpaceRelease(cs);
}

static void draw_outlined_text(CGContextRef ctx, NSString *text, CGFloat cx, CGFloat cy, NSString *fontName, CGFloat fontSize, RGBA fillC, RGBA strokeC, CGFloat strokeW) {
    CTFontRef font = CTFontCreateWithName((__bridge CFStringRef)fontName, fontSize, NULL);
    CGColorRef fcg = cg_color(fillC);
    CGColorRef scg = cg_color(strokeC);

    NSDictionary *sAttrs = @{
        (__bridge id)kCTFontAttributeName: (__bridge id)font,
        (__bridge id)kCTForegroundColorAttributeName: (__bridge id)scg,
        (__bridge id)kCTStrokeColorAttributeName: (__bridge id)scg,
        (__bridge id)kCTStrokeWidthAttributeName: @(strokeW * 2.0),
    };
    NSDictionary *fAttrs = @{
        (__bridge id)kCTFontAttributeName: (__bridge id)font,
        (__bridge id)kCTForegroundColorAttributeName: (__bridge id)fcg,
    };
    NSAttributedString *sStr = [[NSAttributedString alloc] initWithString:text attributes:sAttrs];
    NSAttributedString *fStr = [[NSAttributedString alloc] initWithString:text attributes:fAttrs];
    CTLineRef sLine = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)sStr);
    CTLineRef fLine = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)fStr);
    CGRect bounds = CTLineGetBoundsWithOptions(fLine, kCTLineBoundsUseGlyphPathBounds);
    CGFloat x = cx - bounds.size.width / 2.0 - bounds.origin.x;
    CGFloat y = cy - bounds.size.height / 2.0 - bounds.origin.y;

    CGContextSaveGState(ctx);
    CGContextSetTextMatrix(ctx, CGAffineTransformIdentity);
    CGContextSetTextPosition(ctx, x, y);
    CTLineDraw(sLine, ctx);
    CGContextSetTextPosition(ctx, x, y);
    CTLineDraw(fLine, ctx);
    CGContextRestoreGState(ctx);

    CFRelease(sLine); CFRelease(fLine);
    CGColorRelease(fcg); CGColorRelease(scg);
    CFRelease(font);
}

// ---------- Pixel Canvas ----------
typedef struct {
    int w, h;
    uint8_t *buf;
} Pix;

static Pix pix_new(int w, int h) {
    Pix p = { w, h, (uint8_t *)calloc((size_t)w * (size_t)h * 4, 1) };
    return p;
}
static void pix_free(Pix *p) { free(p->buf); p->buf = NULL; }
static void pix_set(Pix *p, int x, int y, RGBA c) {
    if (x < 0 || y < 0 || x >= p->w || y >= p->h || c.a == 0) return;
    int idx = (y * p->w + x) * 4;
    if (c.a == 255) {
        p->buf[idx] = c.r; p->buf[idx+1] = c.g; p->buf[idx+2] = c.b; p->buf[idx+3] = 255;
    } else {
        double sa = c.a / 255.0;
        double da = p->buf[idx+3] / 255.0;
        double oa = sa + da * (1.0 - sa);
        if (oa > 0) {
            p->buf[idx]   = (uint8_t)fmin(255, (c.r * sa + p->buf[idx]   * da * (1.0 - sa)) / oa);
            p->buf[idx+1] = (uint8_t)fmin(255, (c.g * sa + p->buf[idx+1] * da * (1.0 - sa)) / oa);
            p->buf[idx+2] = (uint8_t)fmin(255, (c.b * sa + p->buf[idx+2] * da * (1.0 - sa)) / oa);
            p->buf[idx+3] = (uint8_t)fmin(255, oa * 255.0);
        }
    }
}
static void pix_rect(Pix *p, int x, int y, int rw, int rh, RGBA c) {
    for (int py = y; py < y + rh; py++)
        for (int px = x; px < x + rw; px++)
            pix_set(p, px, py, c);
}
static void pix_stroke(Pix *p, int x, int y, int rw, int rh, RGBA c) {
    for (int px = x; px < x + rw; px++) { pix_set(p, px, y, c); pix_set(p, px, y + rh - 1, c); }
    for (int py = y; py < y + rh; py++) { pix_set(p, x, py, c); pix_set(p, x + rw - 1, py, c); }
}
static void pix_circle(Pix *p, int cx, int cy, int r, RGBA c) {
    int r2 = r * r;
    for (int dy = -r; dy <= r; dy++)
        for (int dx = -r; dx <= r; dx++)
            if (dx*dx + dy*dy <= r2) pix_set(p, cx + dx, cy + dy, c);
}
static void pix_line(Pix *p, int x0, int y0, int x1, int y1, RGBA c, int thick) {
    int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    int dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    int err = dx + dy;
    while (1) {
        if (thick <= 1) pix_set(p, x0, y0, c);
        else pix_rect(p, x0 - thick/2, y0 - thick/2, thick, thick, c);
        if (x0 == x1 && y0 == y1) break;
        int e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}
static CGImageRef pix_to_cgimage(Pix *p) {
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    NSData *data = [NSData dataWithBytes:p->buf length:(size_t)p->w * (size_t)p->h * 4];
    CGDataProviderRef prov = CGDataProviderCreateWithCFData((__bridge CFDataRef)data);
    CGImageRef img = CGImageCreate(p->w, p->h, 8, 32, p->w * 4, cs, kCGBitmapByteOrderDefault | kCGImageAlphaLast, prov, NULL, false, kCGRenderingIntentDefault);
    CGDataProviderRelease(prov);
    CGColorSpaceRelease(cs);
    return img;
}
static void pix_save(Pix *p, NSString *relPath) {
    CGImageRef img = pix_to_cgimage(p);
    save_cgimage(img, [gOutRoot stringByAppendingPathComponent:relPath]);
    CGImageRelease(img);
}

// =========================================================================
// 1. 3-PART CHARACTER SPRITES: AI-PORTRAIT DERIVED HEADS + PIXEL BODIES/LEGS
// =========================================================================
typedef struct {
    const char *key;
    int cls;
    int portraitCell; // 0..15 index in portraits-sheet.png!
    uint32_t primary, secondary, trim, weapon;
} SpriteSpec;

static void gen_sprites(void) {
    SpriteSpec specs[] = {
        {"r1",  1,  0, 0x2a5cb8, 0x1b376e, 0xf2c64b, 0xdce6f2}, // young male warrior
        {"r1n", 1, 13, 0xc92c2c, 0x7a1616, 0xf8d465, 0xe6effa}, // young female warrior
        {"r2",  2,  4, 0x2c789e, 0x1a4861, 0xf0d67a, 0xf5f2e6}, // male strategist
        {"r2n", 2,  5, 0x2b8c63, 0x185239, 0xffe07d, 0xfff6d6}, // female strategist
        {"r3",  3, 10, 0x7034a8, 0x421c66, 0xffe169, 0x7cf0ff}, // male mystic
        {"r3n", 3, 12, 0xa3328f, 0x5c1950, 0xffe278, 0x8ef5ff}, // female mystic
        {"n1",  1, 14, 0x7c4a26, 0x4a2a14, 0xd99b38, 0xbac4cf}, // bandit / enemy warrior
        {"n2",  2,  8, 0x585e30, 0x34381b, 0xd9b343, 0xd9cfa9}, // enemy strategist
        {"n2n", 2,  7, 0x8a3a4a, 0x4f1e28, 0xe8bd54, 0xf2e4c4}, // enemy female strategist
        {"n3",  3, 11, 0xb8861e, 0x6e4d0c, 0xffe875, 0x9bff75}, // yellow turban sage
        {"n3n", 3,  3, 0x7d2948, 0x471527, 0xf2c95c, 0xc27dff}, // enemy warlord/priestess
    };
    CGImageRef sheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"portraits-sheet.png"]);
    double cw = sheet ? CGImageGetWidth(sheet) / 4.0 : 256.0;
    double ch = sheet ? CGImageGetHeight(sheet) / 4.0 : 256.0;

    RGBA O = rgb(0x140d0a), W = rgb(0xffffff), bootD = rgb(0x261c16), bootM = rgb(0x4a3728), hdl = rgb(0x70421c);

    int count = (int)(sizeof(specs) / sizeof(specs[0]));
    for (int i = 0; i < count; i++) {
        SpriteSpec s = specs[i];
        // HEAD (21x21): crisp circular-framed head extracted directly from our 10/10 AI portraits!
        if (sheet) {
            int col = s.portraitCell % 4, row = s.portraitCell / 4;
            // Tight face/head crop (centered upper 70% of portrait cell)
            CGRect faceRect = CGRectMake(
                round(col * cw + cw * 0.16),
                round(row * ch + ch * 0.04),
                round(cw * 0.68),
                round(ch * 0.68)
            );
            CGImageRef face = CGImageCreateWithImageInRect(sheet, faceRect);
            CGContextRef hc = create_ctx(21, 21);
            CGContextSaveGState(hc);
            CGContextAddEllipseInRect(hc, CGRectMake(1, 1, 19, 19));
            CGContextClip(hc);
            CGContextSetInterpolationQuality(hc, kCGInterpolationHigh);
            CGContextDrawImage(hc, CGRectMake(0, 0, 21, 21), face);
            CGContextRestoreGState(hc);
            // Crisp dark-gold pixel rim
            CGColorRef rim = cg_color(rgb(0x1c120c));
            CGContextSetStrokeColorWithColor(hc, rim);
            CGContextSetLineWidth(hc, 1.4);
            CGContextStrokeEllipseInRect(hc, CGRectMake(1, 1, 19, 19));
            CGColorRelease(rim);
            CGImageRef hout = CGBitmapContextCreateImage(hc);
            save_cgimage(hout, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_h.png", s.key]]);
            CGImageRelease(hout); CGContextRelease(hc); CGImageRelease(face);
        }

        RGBA P = rgb(s.primary), D = rgb(s.secondary), T = rgb(s.trim), Wp = rgb(s.weapon);
        if (s.cls == 1) {
            Pix b = pix_new(60, 15);
            pix_rect(&b, 3, 0, 2, 14, hdl); pix_rect(&b, 2, 0, 4, 3, Wp);
            pix_rect(&b, 6, 2, 12, 11, O); pix_rect(&b, 7, 3, 10, 9, P);
            pix_rect(&b, 8, 3, 8, 2, T); pix_rect(&b, 7, 9, 10, 2, D); pix_rect(&b, 10, 5, 4, 4, T);
            pix_rect(&b, 22, 6, 20, 2, hdl); pix_rect(&b, 22, 4, 7, 5, Wp); pix_rect(&b, 23, 5, 4, 3, W);
            pix_rect(&b, 38, 2, 15, 11, O); pix_rect(&b, 39, 3, 13, 9, P);
            pix_rect(&b, 40, 3, 11, 2, T); pix_rect(&b, 39, 9, 13, 2, D); pix_rect(&b, 43, 5, 5, 4, T);
            pix_save(&b, [NSString stringWithFormat:@"%s_b.png", s.key]); pix_free(&b);

            Pix f = pix_new(37, 10);
            pix_rect(&f, 4, 1, 10, 3, D);
            pix_rect(&f, 4, 4, 4, 5, bootD); pix_rect(&f, 5, 4, 2, 4, bootM);
            pix_rect(&f, 10, 4, 4, 5, bootD); pix_rect(&f, 11, 4, 2, 4, bootM);
            pix_rect(&f, 21, 1, 13, 3, D);
            pix_rect(&f, 19, 4, 5, 5, bootD); pix_rect(&f, 20, 4, 3, 4, bootM);
            pix_rect(&f, 30, 4, 5, 5, bootD); pix_rect(&f, 31, 4, 3, 4, bootM);
            pix_save(&f, [NSString stringWithFormat:@"%s_f.png", s.key]); pix_free(&f);
        } else if (s.cls == 2) {
            Pix b = pix_new(61, 16);
            pix_rect(&b, 5, 2, 13, 12, O); pix_rect(&b, 6, 3, 11, 10, P);
            pix_rect(&b, 10, 3, 3, 10, D); pix_rect(&b, 6, 10, 11, 2, T);
            pix_rect(&b, 2, 4, 5, 6, Wp); pix_stroke(&b, 2, 4, 5, 6, O);
            pix_rect(&b, 25, 3, 9, 9, Wp); pix_stroke(&b, 25, 3, 9, 9, T);
            pix_rect(&b, 36, 2, 16, 12, O); pix_rect(&b, 37, 3, 14, 10, P);
            pix_rect(&b, 42, 3, 4, 10, D); pix_rect(&b, 37, 10, 14, 2, T);
            pix_save(&b, [NSString stringWithFormat:@"%s_b.png", s.key]); pix_free(&b);

            Pix f = pix_new(28, 9);
            pix_rect(&f, 2, 0, 10, 4, D); pix_rect(&f, 3, 4, 3, 4, bootD); pix_rect(&f, 8, 4, 3, 4, bootD);
            pix_rect(&f, 15, 0, 12, 4, D); pix_rect(&f, 15, 4, 4, 4, bootD); pix_rect(&f, 22, 4, 4, 4, bootD);
            pix_save(&f, [NSString stringWithFormat:@"%s_f.png", s.key]); pix_free(&f);
        } else {
            Pix b = pix_new(67, 15);
            pix_rect(&b, 4, 1, 3, 11, Wp); pix_rect(&b, 5, 2, 1, 9, W);
            pix_rect(&b, 10, 2, 13, 11, O); pix_rect(&b, 11, 3, 11, 9, P);
            pix_rect(&b, 14, 3, 5, 9, D); pix_rect(&b, 11, 8, 11, 2, T);
            pix_rect(&b, 32, 5, 11, 3, Wp); pix_rect(&b, 33, 6, 8, 1, W);
            pix_rect(&b, 44, 2, 16, 11, O); pix_rect(&b, 45, 3, 14, 9, P);
            pix_rect(&b, 49, 3, 6, 9, D); pix_rect(&b, 45, 8, 14, 2, T);
            pix_save(&b, [NSString stringWithFormat:@"%s_b.png", s.key]); pix_free(&b);

            Pix f = pix_new(28, 8);
            pix_rect(&f, 2, 0, 10, 3, D); pix_rect(&f, 3, 3, 3, 4, bootD); pix_rect(&f, 8, 3, 3, 4, bootD);
            pix_rect(&f, 15, 0, 12, 3, D); pix_rect(&f, 15, 3, 4, 4, bootD); pix_rect(&f, 22, 3, 4, 4, bootD);
            pix_save(&f, [NSString stringWithFormat:@"%s_f.png", s.key]); pix_free(&f);
        }
    }
    if (sheet) CGImageRelease(sheet);
}

// =========================================================================
// 2. RICH CHINESE INK-AND-PIXEL BATTLEFIELD BIOMES (480x70 -> 120x35 tiles)
// =========================================================================
typedef struct {
    const char *prefix;
    uint32_t skyTop, skyMid, skyBot, sunCol, mtnFar, mtnMid, mtnNear, accent, groundTop, groundBot;
    int style; // 0=city_green, 1=peach, 2=autumn_fort, 3=imperial_city, 4=mountain_pass, 5=desert_camp, 6=dusk_river, 7=chibi_fire
} BiomeSpec;

static void gen_biomes(void) {
    BiomeSpec biomes[] = {
        {"f_bg2",  0x1f497d, 0x4d82b8, 0xa8d0e6, 0xfff3c4, 0x3f6b5c, 0x2e5940, 0x1e4228, 0x8f3328, 0x5c7536, 0x384a1e, 0},
        {"f_bg4",  0x2c568c, 0x6b9ac9, 0xd4e4f2, 0xfff5d6, 0x4f7868, 0x3b634b, 0x284a32, 0xf28db2, 0x69823e, 0x425425, 1},
        {"f_bg5",  0x364f6b, 0x7d8a96, 0xe3cf9d, 0xffe49e, 0x6b6043, 0x52462c, 0x3b301c, 0xb87a28, 0x8a7941, 0x594c24, 2},
        {"f_bg6",  0x1a3052, 0x4a698f, 0x9cb3c9, 0xffedb8, 0x445163, 0x323b4a, 0x222833, 0xb52b24, 0x6b675e, 0x423f38, 3},
        {"f_bg7",  0x2b253d, 0x6e4f5c, 0xc78f75, 0xffd08a, 0x57433c, 0x403029, 0x2b1f1a, 0xc93524, 0x6b563c, 0x423220, 4},
        {"f_bg8",  0x473a29, 0x8c704c, 0xdeb985, 0xffe6a6, 0x7d613b, 0x5e4729, 0x42311a, 0xd9a84e, 0x8f7443, 0x5c4825, 5},
        {"f_bg9",  0x161936, 0x48385e, 0xa86c73, 0xffb38a, 0x38324d, 0x29243b, 0x1a1729, 0xe8a838, 0x4d4736, 0x2e2a1e, 6},
        {"f_bg20", 0x240709, 0x7d1912, 0xeb6b26, 0xffd666, 0x591912, 0x3d0f0b, 0x240706, 0xffb833, 0x662d1a, 0x36140b, 7},
    };
    int n = (int)(sizeof(biomes) / sizeof(biomes[0]));
    for (int i = 0; i < n; i++) {
        BiomeSpec b = biomes[i];
        // Render at 2x (480x70) with rich painterly CoreGraphics layers, then split into 240x70 (2x crisp)
        CGContextRef c = create_ctx(480, 70);
        draw_gradient(c, CGRectMake(0, 0, 480, 70), rgb(b.skyTop), rgb(b.skyMid), rgb(b.skyBot), true);
        // Sun / Moon atmospheric glow
        draw_radial_glow(c, CGPointMake(370, 50), 65, rgba_hex(b.sunCol, 175), rgba_hex(b.sunCol, 0));
        // Soft clouds
        CGColorRef cl = cg_color(rgba_hex(b.sunCol, 55));
        CGContextSetFillColorWithColor(c, cl);
        for (int cx = 30; cx < 460; cx += 95) {
            CGContextFillEllipseInRect(c, CGRectMake(cx, 44 + (cx % 12), 68, 12));
        }
        CGColorRelease(cl);

        // 3-layer ink-wash Chinese mountain ridges (CoreGraphics y=0 is bottom!)
        uint32_t mCols[3] = {b.mtnFar, b.mtnMid, b.mtnNear};
        double baseH[3] = {38, 26, 16};
        double amp[3] = {15, 11, 7};
        double freq[3] = {0.018, 0.029, 0.045};
        for (int L = 0; L < 3; L++) {
            CGMutablePathRef path = CGPathCreateMutable();
            CGPathMoveToPoint(path, NULL, 0, 0);
            for (int x = 0; x <= 480; x += 4) {
                double y = baseH[L] + sin(x * freq[L] + L * 1.9) * amp[L] + cos(x * freq[L] * 2.3 + i) * (amp[L] * 0.45);
                CGPathAddLineToPoint(path, NULL, x, y);
            }
            CGPathAddLineToPoint(path, NULL, 480, 0);
            CGPathCloseSubpath(path);
            CGColorRef mc = cg_color(rgb(mCols[L]));
            CGContextSetFillColorWithColor(c, mc);
            CGContextAddPath(c, path);
            CGContextFillPath(c);
            CGColorRelease(mc);
            CGPathRelease(path);
            // Mist band between layers
            draw_gradient(c, CGRectMake(0, 0, 480, 14), rgba_hex(b.skyBot, 0), rgba_hex(b.skyBot, 40), rgba_hex(b.skyBot, 85), false);
        }

        // Architectural / landscape landmarks
        if (b.style == 0 || b.style == 2 || b.style == 3 || b.style == 4) {
            // Ancient Chinese city wall + curved gatehouse pagoda
            CGColorRef wall = cg_color(rgb(0x524f49)), wallH = cg_color(rgb(0x6e6a62)), roof = cg_color(rgb(0x261f1d)), ac = cg_color(rgb(b.accent));
            CGContextSetFillColorWithColor(c, wall);
            CGContextFillRect(c, CGRectMake(40, 0, 400, 22));
            CGContextSetFillColorWithColor(c, wallH);
            for (int x = 44; x < 436; x += 14) CGContextFillRect(c, CGRectMake(x, 22, 8, 5));
            // Gatehouse pavilion at center
            CGContextSetFillColorWithColor(c, ac);
            CGContextFillRect(c, CGRectMake(205, 22, 70, 18));
            // Curved eaves roof
            CGContextSetFillColorWithColor(c, roof);
            CGMutablePathRef r1 = CGPathCreateMutable();
            CGPathMoveToPoint(r1, NULL, 190, 38); CGPathAddLineToPoint(r1, NULL, 290, 38);
            CGPathAddLineToPoint(r1, NULL, 272, 48); CGPathAddLineToPoint(r1, NULL, 208, 48); CGPathCloseSubpath(r1);
            CGContextAddPath(c, r1); CGContextFillPath(c); CGPathRelease(r1);
            CGMutablePathRef r2 = CGPathCreateMutable();
            CGPathMoveToPoint(r2, NULL, 206, 48); CGPathAddLineToPoint(r2, NULL, 274, 48);
            CGPathAddLineToPoint(r2, NULL, 256, 57); CGPathAddLineToPoint(r2, NULL, 224, 57); CGPathCloseSubpath(r2);
            CGContextAddPath(c, r2); CGContextFillPath(c); CGPathRelease(r2);
            // Glowing lanterns
            CGColorRef gl = cg_color(rgb(0xffdc66));
            CGContextSetFillColorWithColor(c, gl);
            CGContextFillRect(c, CGRectMake(222, 26, 6, 8)); CGContextFillRect(c, CGRectMake(252, 26, 6, 8));
            CGColorRelease(gl); CGColorRelease(wall); CGColorRelease(wallH); CGColorRelease(roof); CGColorRelease(ac);
        } else if (b.style == 7) {
            // Chibi burning river ships + embers + glowing water reflections!
            CGColorRef river = cg_color(rgb(0x3b120e)), boat = cg_color(rgb(0x1f0a08));
            CGContextSetFillColorWithColor(c, river); CGContextFillRect(c, CGRectMake(0, 0, 480, 14));
            for (int bx = 65; bx < 430; bx += 95) {
                CGContextSetFillColorWithColor(c, boat);
                CGContextFillRect(c, CGRectMake(bx, 10, 44, 7));
                CGContextFillRect(c, CGRectMake(bx + 18, 17, 3, 20));
                draw_radial_glow(c, CGPointMake(bx + 20, 22), 26, rgba_hex(0xffa629, 210), rgba_hex(0xe63512, 0));
                draw_radial_glow(c, CGPointMake(bx + 20, 5), 22, rgba_hex(0xff7b24, 130), rgba_hex(0xff7b24, 0));
            }
            CGColorRelease(river); CGColorRelease(boat);
        } else {
            // Natural varied pine & peach groves along horizon
            CGColorRef tr = cg_color(rgb(b.mtnNear)), tr2 = cg_color(rgb(b.mtnMid)), ac = cg_color(rgb(b.accent));
            int tx = 10;
            int step = 0;
            while (tx < 470) {
                int h = 18 + ((tx * 7 + step * 13) % 18);
                int w = 8 + ((tx * 3 + step * 5) % 6);
                CGContextSetFillColorWithColor(c, (step % 2 == 0) ? tr : tr2);
                CGMutablePathRef pine = CGPathCreateMutable();
                CGPathMoveToPoint(pine, NULL, tx - w, 0); CGPathAddLineToPoint(pine, NULL, tx + w, 0);
                CGPathAddLineToPoint(pine, NULL, tx, h); CGPathCloseSubpath(pine);
                CGContextAddPath(c, pine); CGContextFillPath(c); CGPathRelease(pine);
                if (b.style == 1 && (step % 3 != 1)) {
                    CGContextSetFillColorWithColor(c, ac);
                    CGContextFillEllipseInRect(c, CGRectMake(tx - w * 0.7, h * 0.55, w * 1.4, h * 0.35));
                }
                tx += 21 + ((step * 11) % 19);
                step++;
            }
            CGColorRelease(tr); CGColorRelease(tr2); CGColorRelease(ac);
        }

        CGImageRef fullTop = CGBitmapContextCreateImage(c);
        CGImageRef left5 = CGImageCreateWithImageInRect(fullTop, CGRectMake(0, 0, 240, 70));
        CGImageRef right6 = CGImageCreateWithImageInRect(fullTop, CGRectMake(240, 0, 240, 70));
        save_cgimage(left5, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_5.png", b.prefix]]);
        save_cgimage(right6, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_6.png", b.prefix]]);
        CGImageRelease(left5); CGImageRelease(right6); CGImageRelease(fullTop); CGContextRelease(c);

        // Bottom strip 480x30 -> split _3 / _4
        CGContextRef bc = create_ctx(480, 30);
        draw_gradient(bc, CGRectMake(0, 0, 480, 30), rgb(b.groundTop), rgb(b.groundTop), rgb(b.groundBot), false);
        CGColorRef tuft = cg_color(rgb(b.mtnNear)), hi = cg_color(rgba_hex(b.accent, 130));
        for (int gx = 10; gx < 470; gx += 22) {
            CGContextSetFillColorWithColor(bc, tuft);
            CGContextFillEllipseInRect(bc, CGRectMake(gx, 4 + (gx % 12), 14, 5));
            CGContextSetFillColorWithColor(bc, hi);
            CGContextFillRect(bc, CGRectMake(gx + 4, 8 + (gx % 9), 5, 2));
        }
        CGColorRelease(tuft); CGColorRelease(hi);
        CGImageRef fullBot = CGBitmapContextCreateImage(bc);
        CGImageRef left3 = CGImageCreateWithImageInRect(fullBot, CGRectMake(0, 0, 240, 30));
        CGImageRef right4 = CGImageCreateWithImageInRect(fullBot, CGRectMake(240, 0, 240, 30));
        save_cgimage(left3, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_3.png", b.prefix]]);
        save_cgimage(right4, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_4.png", b.prefix]]);
        CGImageRelease(left3); CGImageRelease(right4); CGImageRelease(fullBot); CGContextRelease(bc);
    }
}

// =========================================================================
// 3. CC0 DCSS BATTLE VFX + PIXEL NUMBERS & STATUS GLYPHS
// =========================================================================
static void gen_vfx(void) {
    // f_sd.png (96x71): 3 frames [0,36], [36,33], [69,27] using CC0 DCSS bolt tiles + lightning arcs
    CGContextRef sdc = create_ctx(96, 71);
    NSArray *bolts = @[@"vfx_bolt1.png", @"vfx_bolt2.png", @"vfx_bolt3.png"];
    int sx[3] = {0, 36, 69}, sw[3] = {36, 33, 27};
    for (int i = 0; i < 3; i++) {
        CGImageRef bi = load_cgimage([gCc0Dir stringByAppendingPathComponent:bolts[i]]);
        if (bi) {
            CGContextSetInterpolationQuality(sdc, kCGInterpolationNone);
            CGContextDrawImage(sdc, CGRectMake(sx[i], 0, sw[i], 38), bi);
            CGContextDrawImage(sdc, CGRectMake(sx[i], 33, sw[i], 38), bi);
            CGImageRelease(bi);
        }
    }
    CGImageRef sdImg = CGBitmapContextCreateImage(sdc);
    save_cgimage(sdImg, [gOutRoot stringByAppendingPathComponent:@"f_sd.png"]);
    CGImageRelease(sdImg); CGContextRelease(sdc);

    // fire.png (66x44): 3 CC0 DCSS flame frames [0,25], [25,20], [45,21]
    CGContextRef fc = create_ctx(66, 44);
    NSArray *flames = @[@"vfx_flame0.png", @"vfx_flame1.png", @"vfx_flame2.png"];
    int fx[3] = {0, 25, 45}, fw[3] = {25, 20, 21};
    for (int i = 0; i < 3; i++) {
        CGImageRef fi = load_cgimage([gCc0Dir stringByAppendingPathComponent:flames[i]]);
        if (fi) {
            CGContextSetInterpolationQuality(fc, kCGInterpolationNone);
            CGContextDrawImage(fc, CGRectMake(fx[i], 2, fw[i], 40), fi);
            CGImageRelease(fi);
        }
    }
    CGImageRef fiImg = CGBitmapContextCreateImage(fc);
    save_cgimage(fiImg, [gOutRoot stringByAppendingPathComponent:@"fire.png"]);
    CGImageRelease(fiImg); CGContextRelease(fc);

    // dead_fl.png (111x43): 4 CC0 DCSS ghostfire frames [0,31], [31,30], [61,32], [93,18]
    CGContextRef dfc = create_ctx(111, 43);
    int dx[4] = {0, 31, 61, 93}, dw[4] = {31, 30, 32, 18};
    for (int i = 0; i < 4; i++) {
        CGImageRef gi = load_cgimage([gCc0Dir stringByAppendingPathComponent:(i % 2 == 0 ? @"vfx_ghost0.png" : @"vfx_ghost1.png")]);
        if (gi) {
            CGContextSetInterpolationQuality(dfc, kCGInterpolationNone);
            CGContextDrawImage(dfc, CGRectMake(dx[i], 2, dw[i], 39), gi);
            CGImageRelease(gi);
        }
    }
    CGImageRef dfImg = CGBitmapContextCreateImage(dfc);
    save_cgimage(dfImg, [gOutRoot stringByAppendingPathComponent:@"dead_fl.png"]);
    CGImageRelease(dfImg); CGContextRelease(dfc);

    // fg.png (92x68), fg2.png (104x28), fg3.png (166x33), pi_fl.png (86x35)
    Pix fg = pix_new(92, 68);
    for (int a=0;a<360;a+=30) {
        double rad = a * M_PI / 180.0;
        double len = (a % 60 == 0) ? 26.0 : 17.0;
        pix_line(&fg, 59, 34, 59+(int)(cos(rad)*len), 34+(int)(sin(rad)*len), rgba_hex(0x52d1ff,220), 3);
        pix_line(&fg, 59, 34, 59+(int)(cos(rad)*len*0.7), 34+(int)(sin(rad)*len*0.7), rgb(0xffffff), 1);
    }
    pix_circle(&fg, 59, 34, 7, rgb(0xffffff));
    pix_save(&fg, @"fg.png"); pix_free(&fg);

    Pix fg2 = pix_new(104, 28);
    int g2[4][2] = {{0,24},{26,28},{54,22},{78,25}};
    for (int i=0;i<4;i++) {
        int cx = g2[i][0] + g2[i][1]/2, r = 5 + (i % 3) * 2;
        pix_rect(&fg2, cx-r, 2, r*2, 24, rgba_hex(0xffc837,170));
        pix_rect(&fg2, cx-r/2, 0, r, 28, rgba_hex(0xfff6b8,230));
        pix_circle(&fg2, cx, 14, r, rgba_hex(0xffffff,200));
    }
    pix_save(&fg2, @"fg2.png"); pix_free(&fg2);

    Pix fg3 = pix_new(166, 33);
    int g3[5][2] = {{0,39},{40,37},{78,34},{114,24},{139,27}};
    for (int i=0;i<5;i++) {
        int cx = g3[i][0] + g3[i][1]/2, r = g3[i][1]/2 - 2; if (r > 13) r = 13;
        pix_circle(&fg3, cx, 16, r, rgba_hex(0x8b2fc9,175));
        pix_circle(&fg3, cx, 16, r>4?r-4:3, rgba_hex(0xe38aff,220));
        pix_circle(&fg3, cx+(i-2)*2, 16, 3, rgba_hex(0xffffff,220));
    }
    pix_save(&fg3, @"fg3.png"); pix_free(&fg3);

    Pix pf = pix_new(86, 35);
    int p3[3][2] = {{0,30},{30,32},{62,24}};
    for (int i=0;i<3;i++) {
        int cx = p3[i][0] + p3[i][1]/2;
        pix_circle(&pf, cx, 17, 10, rgba_hex(0x2ca9e8,190));
        pix_circle(&pf, cx, 15, 6, rgba_hex(0xc2f6ff,240));
    }
    pix_save(&pf, @"pi_fl.png"); pix_free(&pf);

    Pix bl = pix_new(38, 22);
    pix_circle(&bl, 11, 11, 7, rgba_hex(0xc91414,230));
    pix_circle(&bl, 6, 6, 3, rgb(0xff3b3b)); pix_circle(&bl, 16, 15, 3, rgb(0xe61919));
    pix_circle(&bl, 30, 11, 5, rgba_hex(0xd91c1c,220)); pix_circle(&bl, 27, 6, 2, rgb(0xff5252));
    pix_save(&bl, @"blood.png"); pix_free(&bl);

    Pix sm = pix_new(60, 12);
    int s3[3][2] = {{0,20},{22,17},{41,17}};
    for (int i=0;i<3;i++) {
        pix_circle(&sm, s3[i][0]+s3[i][1]/2-3, 6, 4, rgba_hex(0xd9cfb8,190));
        pix_circle(&sm, s3[i][0]+s3[i][1]/2+2, 5, 3, rgba_hex(0xf0e9d8,210));
    }
    pix_save(&sm, @"smoke.png"); pix_free(&sm);

    Pix dead = pix_new(31, 16);
    pix_rect(&dead, 6, 10, 19, 4, rgb(0x3b3632));
    pix_rect(&dead, 10, 3, 11, 9, rgb(0x8c8780));
    pix_stroke(&dead, 10, 3, 11, 9, rgb(0x262220));
    pix_rect(&dead, 14, 5, 3, 5, rgb(0x423e3a));
    pix_save(&dead, @"dead_1.png"); pix_free(&dead);

    Pix yz = pix_new(12, 9); pix_circle(&yz, 6, 4, 4, rgba_hex(0x000000,110));
    pix_save(&yz, @"yz.png"); pix_free(&yz);

    CGContextRef wzCtx = create_ctx(25, 13);
    draw_outlined_text(wzCtx, @"闪", 12.5, 6.5, @"STHeitiSC-Medium", 11, rgb(0xfff199), rgb(0x1a0a00), 1.5);
    CGImageRef wzImg = CGBitmapContextCreateImage(wzCtx);
    save_cgimage(wzImg, [gOutRoot stringByAppendingPathComponent:@"wz.png"]);
    CGImageRelease(wzImg); CGContextRelease(wzCtx);

    Pix jt = pix_new(50, 50);
    for (int y=12;y<38;y++) { int half=(38-y)/2; pix_rect(&jt, 25-half, y, half>0?half*2:1, 1, rgb(0xffe047)); }
    pix_rect(&jt, 21, 6, 8, 10, rgb(0xffb01c));
    pix_save(&jt, @"f_jt.png"); pix_free(&jt);

    Pix bgc = pix_new(31, 27); pix_rect(&bgc, 0, 0, 31, 27, rgb(0x2b1a14)); pix_stroke(&bgc, 0, 0, 31, 27, rgb(0xc99c3b));
    pix_save(&bgc, @"f_bg_c.png"); pix_free(&bgc);
    Pix bgc2 = pix_new(29, 20); pix_rect(&bgc2, 0, 0, 29, 20, rgb(0x241410)); pix_stroke(&bgc2, 0, 0, 29, 20, rgb(0xb0842c));
    pix_save(&bgc2, @"f_bg_c2.png"); pix_free(&bgc2);

    NSArray *stLbls = @[@"封",@"围",@"攻",@"乱",@"毒",@"速",@"隐",@"固"];
    int stX[8] = {0,15,30,45,60,75,89,103};
    int stW[8] = {15,15,15,15,15,14,14,15};
    uint32_t stC[8] = {0x136ea8,0x8f5b0d,0xb82a14,0x9e198b,0x1e7a2c,0x107a8f,0x4b4c6b,0x6b4c1c};
    CGContextRef stCtx = create_ctx(118, 19);
    for (int i=0;i<8;i++) {
        CGColorRef bg = cg_color(rgb(stC[i])); CGColorRef bd = cg_color(rgb(0xffe27a));
        CGContextSetFillColorWithColor(stCtx, bg); CGContextFillRect(stCtx, CGRectMake(stX[i]+1, 1, stW[i]-2, 17));
        CGContextSetStrokeColorWithColor(stCtx, bd); CGContextSetLineWidth(stCtx, 1); CGContextStrokeRect(stCtx, CGRectMake(stX[i]+1.5, 1.5, stW[i]-3, 16));
        CGColorRelease(bg); CGColorRelease(bd);
        draw_outlined_text(stCtx, stLbls[i], stX[i] + stW[i]/2.0, 9.5, @"STHeitiSC-Medium", 11, rgb(0xffffff), rgb(0x000000), 1.2);
    }
    CGImageRef stImg = CGBitmapContextCreateImage(stCtx);
    save_cgimage(stImg, [gOutRoot stringByAppendingPathComponent:@"f_stat.png"]);
    CGImageRelease(stImg); CGContextRelease(stCtx);

    NSArray *digits = @[@"0",@"1",@"2",@"3",@"4",@"5",@"6",@"7",@"8",@"9",@"-"];
    int dx1[11] = {0,50,86,126,162,198,243,284,324,365,405};
    int dw1[11] = {36,22,36,36,36,36,36,36,36,36,41};
    int dx2[11] = {0,50,86,126,162,203,243,279,324,365,405};
    CGContextRef n1 = create_ctx(446, 50), n2 = create_ctx(446, 50);
    for (int i=0;i<11;i++) {
        draw_outlined_text(n1, digits[i], dx1[i] + dw1[i]/2.0, 25, @"Helvetica-Bold", 36, rgb(0xffd23f), rgb(0x8c0c08), 3.0);
        draw_outlined_text(n2, digits[i], dx2[i] + dw1[i]/2.0, 25, @"Helvetica-Bold", 36, rgb(0x7dff8a), rgb(0x0a4d1a), 3.0);
    }
    CGImageRef ni1 = CGBitmapContextCreateImage(n1), ni2 = CGBitmapContextCreateImage(n2);
    save_cgimage(ni1, [gOutRoot stringByAppendingPathComponent:@"num.png"]);
    save_cgimage(ni2, [gOutRoot stringByAppendingPathComponent:@"num2.png"]);
    CGImageRelease(ni1); CGImageRelease(ni2); CGContextRelease(n1); CGContextRelease(n2);
}

// =========================================================================
// 4. ORNATE RETRO CHINESE UI BANNERS & BUTTONS
// =========================================================================
static void draw_ornate_corners(CGContextRef c, CGRect r, RGBA col) {
    CGColorRef cg = cg_color(col);
    CGContextSetFillColorWithColor(c, cg);
    CGFloat s = 7;
    CGContextFillRect(c, CGRectMake(r.origin.x, r.origin.y, s, s));
    CGContextFillRect(c, CGRectMake(CGRectGetMaxX(r)-s, r.origin.y, s, s));
    CGContextFillRect(c, CGRectMake(r.origin.x, CGRectGetMaxY(r)-s, s, s));
    CGContextFillRect(c, CGRectMake(CGRectGetMaxX(r)-s, CGRectGetMaxY(r)-s, s, s));
    CGColorRelease(cg);
}

static void gen_ui(void) {
    CGContextRef c = create_ctx(540, 90);
    draw_gradient(c, CGRectMake(0,0,540,90), rgb(0x4b6369), rgb(0x28383d), rgb(0x162024), true);
    CGColorRef g = cg_color(rgb(0xd4aa4a)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 3);
    CGContextStrokeRect(c, CGRectMake(3,4,534,82)); CGColorRelease(g);
    draw_ornate_corners(c, CGRectMake(6,7,528,76), rgb(0xf0cb65));
    CGImageRef im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"tit_bg.png"]);
    CGImageRelease(im); CGContextRelease(c);

    c = create_ctx(540, 90);
    draw_gradient(c, CGRectMake(0,0,540,90), rgb(0x781814), rgb(0x4a0c09), rgb(0x210403), true);
    g = cg_color(rgb(0xf0c254)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 3);
    CGContextStrokeRect(c, CGRectMake(3,3,534,84)); CGColorRelease(g);
    draw_ornate_corners(c, CGRectMake(6,6,528,78), rgb(0xffe07d));
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"fig_tit.png"]);
    CGImageRelease(im); CGContextRelease(c);

    c = create_ctx(482, 333);
    draw_gradient(c, CGRectMake(0,0,482,333), rgb(0x5c1d13), rgb(0x3b100a), rgb(0x240906), true);
    g = cg_color(rgb(0xd6a642)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 6);
    CGContextStrokeRect(c, CGRectMake(4,4,474,325)); CGColorRelease(g);
    CGRect ring = CGRectMake(34, 333-190, 118, 118);
    CGColorRef dk = cg_color(rgb(0x1a0805)); CGContextSetFillColorWithColor(c, dk); CGContextFillEllipseInRect(c, ring); CGColorRelease(dk);
    g = cg_color(rgb(0xf2ca5c)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 6); CGContextStrokeEllipseInRect(c, ring); CGColorRelease(g);
    dk = cg_color(rgb(0x140605)); CGContextSetFillColorWithColor(c, dk);
    CGContextFillRect(c, CGRectMake(164, 333-114, 298, 32)); CGContextFillRect(c, CGRectMake(164, 333-160, 298, 32)); CGColorRelease(dk);
    g = cg_color(rgb(0x9e772e)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 2);
    CGContextStrokeRect(c, CGRectMake(164, 333-114, 298, 32)); CGContextStrokeRect(c, CGRectMake(164, 333-160, 298, 32)); CGColorRelease(g);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"sc_bg_1.png"]);
    CGImageRelease(im); CGContextRelease(c);

    c = create_ctx(441, 117);
    draw_gradient(c, CGRectMake(0,0,441,117), rgb(0x4f1a10), rgb(0x3a120a), rgb(0x260b07), false);
    g = cg_color(rgb(0xcf9f3e)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 4);
    CGContextStrokeRect(c, CGRectMake(3,3,435,111)); CGColorRelease(g);
    for (int i=0;i<3;i++) {
        CGRect slot = CGRectMake(46 + i*124, 15, 100, 87);
        dk = cg_color(rgb(0x170907)); CGContextSetFillColorWithColor(c, dk); CGContextFillRect(c, slot); CGColorRelease(dk);
        g = cg_color(rgb(0xdeb049)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 3); CGContextStrokeRect(c, slot); CGColorRelease(g);
        draw_outlined_text(c, @"将", CGRectGetMidX(slot), CGRectGetMidY(slot), @"STHeitiSC-Medium", 34, rgba_hex(0x6e4b20,120), rgba_hex(0x1a0b05,90), 1.5);
    }
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"sc_fjbg.png"]);
    CGImageRelease(im); CGContextRelease(c);

    NSArray *tabs = @[@"人物",@"设施",@"移动",@"功能"];
    for (int i=0;i<4;i++) {
        c = create_ctx(270, 135);
        draw_gradient(c, CGRectMake(0,0,270,135), rgb(0x5e4628), rgb(0x3a2713), rgb(0x1e1308), true);
        g = cg_color(rgb(0xb89040)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 5);
        CGContextStrokeRect(c, CGRectMake(4,4,262,127)); CGColorRelease(g);
        draw_ornate_corners(c, CGRectMake(9,9,252,117), rgb(0xd4ac55));
        draw_outlined_text(c, tabs[i], 135, 68, @"STHeitiSC-Medium", 54, rgb(0xf5e8c8), rgb(0x1c0d03), 4.0);
        im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"gnk_%d.png", i+1]]);
        CGImageRelease(im); CGContextRelease(c);

        c = create_ctx(270, 135);
        draw_gradient(c, CGRectMake(0,0,270,135), rgb(0xe34b29), rgb(0xa31d12), rgb(0x5c0a06), true);
        g = cg_color(rgb(0xffe680)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 6);
        CGContextStrokeRect(c, CGRectMake(4,4,262,127)); CGColorRelease(g);
        draw_ornate_corners(c, CGRectMake(10,10,250,115), rgb(0xfff5b8));
        draw_outlined_text(c, tabs[i], 135, 68, @"STHeitiSC-Medium", 56, rgb(0xfff7a6), rgb(0x380800), 4.5);
        im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"gnk_s%d.png", i+1]]);
        CGImageRelease(im); CGContextRelease(c);
    }

    c = create_ctx(1080, 221);
    draw_gradient(c, CGRectMake(0,0,1080,221), rgb(0x1c2629), rgb(0x161f22), rgb(0x11171a), false);
    g = cg_color(rgba_hex(0x485e63, 140)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 2);
    for (int y=24;y<220;y+=28) { CGContextMoveToPoint(c, 0, y); CGContextAddLineToPoint(c, 1080, y); CGContextStrokePath(c); }
    CGColorRelease(g);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"chat_bgb.png"]);
    CGImageRelease(im); CGContextRelease(c);

    c = create_ctx(611, 13);
    draw_gradient(c, CGRectMake(0,0,611,13), rgb(0x8f6e2e), rgb(0x6b501e), rgb(0x4a3714), false);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"chat_bq.png"]);
    CGImageRelease(im); CGContextRelease(c);

    c = create_ctx(99, 131);
    draw_gradient(c, CGRectMake(0,0,99,131), rgb(0xebb944), rgb(0xbf7d14), rgb(0x7a4306), true);
    g = cg_color(rgb(0x451803)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 5);
    CGContextStrokeRect(c, CGRectMake(3,3,93,125)); CGColorRelease(g);
    draw_outlined_text(c, @"发", 49.5, 92, @"STHeitiSC-Medium", 40, rgb(0xfff8cf), rgb(0x3b1200), 3.5);
    draw_outlined_text(c, @"言", 49.5, 40, @"STHeitiSC-Medium", 40, rgb(0xfff8cf), rgb(0x3b1200), 3.5);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"chat_fy.png"]);
    CGImageRelease(im); CGContextRelease(c);

    c = create_ctx(684, 261);
    CGRect pl = CGRectMake(52, 32, 580, 196);
    draw_gradient(c, pl, rgba_hex(0xc92618,235), rgba_hex(0x8a110b,245), rgba_hex(0x4a0705,245), true);
    g = cg_color(rgb(0xffe066)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 8); CGContextStrokeRect(c, pl); CGColorRelease(g);
    g = cg_color(rgb(0xfff7c2)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 2); CGContextStrokeRect(c, CGRectInset(pl,10,10)); CGColorRelease(g);
    draw_outlined_text(c, @"大  胜", 342, 132, @"STHeitiSC-Medium", 112, rgb(0xffe86b), rgb(0x3b0700), 7.0);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"f_sl.png"]);
    CGImageRelease(im); CGContextRelease(c);

    c = create_ctx(684, 261);
    draw_gradient(c, pl, rgba_hex(0x3a3e4d,235), rgba_hex(0x222530,245), rgba_hex(0x11131a,245), true);
    g = cg_color(rgb(0x9aa4b8)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 8); CGContextStrokeRect(c, pl); CGColorRelease(g);
    draw_outlined_text(c, @"败  北", 342, 132, @"STHeitiSC-Medium", 112, rgb(0xd9e1f0), rgb(0x12151f), 7.0);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"f_bb.png"]);
    CGImageRelease(im); CGContextRelease(c);
}

// =========================================================================
// 5. MAP MINI-THUMBS (site_m1..10, 12..16)
// =========================================================================
static void gen_map_thumbs(void) {
    int ids[15] = {1,2,3,4,5,6,7,8,9,10,12,13,14,15,16};
    NSArray *cc0Maps = @[
        @"ss_m_3.png",@"ss_m_11.png",@"ss_m_7.png",@"ss_m_4.png",@"ss_m_1.png",
        @"ss_m_6.png",@"ss_m_12.png",@"ss_m_8.png",@"ss_m_9.png",@"ss_m_10.png",
        @"ss_m_2.png",@"ss_m_5.png",@"ss_m_7.png",@"ss_m_8.png",@"ss_m_12.png"
    ];
    for (int i=0;i<15;i++) {
        CGImageRef tile = load_cgimage([gCc0Dir stringByAppendingPathComponent:cc0Maps[i]]);
        CGContextRef c = create_ctx(23, 20);
        draw_gradient(c, CGRectMake(0,0,23,20), rgb(0x24313d), rgb(0x19232c), rgb(0x10171f), false);
        if (tile) {
            CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
            CGContextDrawImage(c, CGRectMake(2, 1, 19, 18), tile);
            CGImageRelease(tile);
        }
        CGColorRef bd = cg_color(rgb(0xb8903c)); CGContextSetStrokeColorWithColor(c, bd); CGContextSetLineWidth(c, 1);
        CGContextStrokeRect(c, CGRectMake(0.5,0.5,22,19)); CGColorRelease(bd);
        CGImageRef out = CGBitmapContextCreateImage(c);
        save_cgimage(out, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"site_m%d.png", ids[i]]]);
        CGImageRelease(out); CGContextRelease(c);
    }
}

// =========================================================================
// 6. CC0 DCSS ARTIST PIXEL ART: 15 EQUIPMENT + 12 FACILITIES + 8 WARHORSES
// =========================================================================
static void composite_cc0_card(NSString *cc0File, int cw, int ch, RGBA bgTop, RGBA bgBot, RGBA border, RGBA glowC, bool hasGlow, int pad, NSString *outRel) {
    CGImageRef tile = load_cgimage([gCc0Dir stringByAppendingPathComponent:cc0File]);
    CGContextRef c = create_ctx(cw, ch);
    draw_gradient(c, CGRectMake(0, 0, cw, ch), bgTop, bgTop, bgBot, false);
    if (hasGlow) {
        draw_radial_glow(c, CGPointMake(cw/2.0, ch/2.0), fmin(cw, ch) * 0.48, rgba_hex((glowC.r<<16)|(glowC.g<<8)|glowC.b, 110), rgba_hex((glowC.r<<16)|(glowC.g<<8)|glowC.b, 0));
    }
    CGColorRef bcg = cg_color(border);
    CGContextSetStrokeColorWithColor(c, bcg); CGContextSetLineWidth(c, 5.0);
    CGContextStrokeRect(c, CGRectMake(2.5, 2.5, cw - 5, ch - 5)); CGColorRelease(bcg);
    CGColorRef icg = cg_color(rgba_hex(0xffffff, 35));
    CGContextSetStrokeColorWithColor(c, icg); CGContextSetLineWidth(c, 1.5);
    CGContextStrokeRect(c, CGRectMake(7, 7, cw - 14, ch - 14)); CGColorRelease(icg);
    if (tile) {
        int tw = (int)CGImageGetWidth(tile), th = (int)CGImageGetHeight(tile);
        // For DCSS shop_* tiles (32x32), mask out the top-left English "Shop" sign (0..18, 0..10) cleanly
        CGImageRef drawTile = tile;
        CGImageRef cropped = NULL;
        if ([cc0File hasPrefix:@"ss_m_"] && (
            [cc0File isEqualToString:@"ss_m_1.png"] || [cc0File isEqualToString:@"ss_m_2.png"] ||
            [cc0File isEqualToString:@"ss_m_3.png"] || [cc0File isEqualToString:@"ss_m_5.png"] ||
            [cc0File isEqualToString:@"ss_m_6.png"] || [cc0File isEqualToString:@"ss_m_7.png"] ||
            [cc0File isEqualToString:@"ss_m_9.png"])) {
            // Focus on the bottom-right icon object (x=10..32, y=10..32) so no English "Shop" sign appears!
            cropped = CGImageCreateWithImageInRect(tile, CGRectMake(10, 10, tw - 10, th - 10));
            if (cropped) { drawTile = cropped; tw = (int)CGImageGetWidth(cropped); th = (int)CGImageGetHeight(cropped); }
        }
        double scale = fmin((double)(cw - pad*2) / tw, (double)(ch - pad*2) / th);
        double dw = round(tw * scale), dh = round(th * scale);
        double dx = round((cw - dw)/2.0), dy = round((ch - dh)/2.0);
        CGContextSetInterpolationQuality(c, kCGInterpolationNone);
        CGContextDrawImage(c, CGRectMake(dx, dy, dw, dh), drawTile);
        if (cropped) CGImageRelease(cropped);
        CGImageRelease(tile);
    }
    CGImageRef out = CGBitmapContextCreateImage(c);
    save_cgimage(out, [gOutRoot stringByAppendingPathComponent:outRel]);
    CGImageRelease(out); CGContextRelease(c);
}

static void gen_cc0_equipment_and_facilities(void) {
    uint32_t eqBorder[15] = {0x9c8b68,0x9c8b68,0x5ca8e6,0xc26ef0,0xffc83d, 0x9c8b68,0x5ca8e6,0xc26ef0, 0x9c8b68,0x5ca8e6,0xc26ef0,0xffc83d, 0x9c8b68,0x5ca8e6,0xffc83d};
    bool eqGlow[15] = {false,false,false,true,true, false,false,true, false,false,true,true, false,false,true};
    for (int i=1;i<=15;i++) {
        NSString *fn = [NSString stringWithFormat:@"sg4b_item%d.png", i];
        composite_cc0_card(fn, 207, 167, rgb(0x3a1442), rgb(0x17061c), rgb(eqBorder[i-1]), rgb(eqBorder[i-1]), eqGlow[i-1], 18, fn);
    }
    for (int i=1;i<=12;i++) {
        NSString *fn = [NSString stringWithFormat:@"ss_m_%d.png", i];
        composite_cc0_card(fn, 104, 90, rgb(0x283645), rgb(0x111821), rgb(0xc99c42), rgb(0xffe07d), i==8 || i==10, 8, fn);
    }
}

// 8 Legendary Warhorses recolored from CC0 OpenGameArt hand-pixelled horse (52x39) + ornate saddle & aura
static void gen_cc0_mounts(void) {
    CGImageRef baseImg = load_cgimage([gCc0Dir stringByAppendingPathComponent:@"horse_horse-0.png"]);
    if (!baseImg) return;
    int bw = (int)CGImageGetWidth(baseImg), bh = (int)CGImageGetHeight(baseImg);
    uint8_t *raw = (uint8_t *)calloc((size_t)bw * (size_t)bh * 4, 1);
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGContextRef rctx = CGBitmapContextCreate(raw, bw, bh, 8, bw * 4, cs, kCGImageAlphaPremultipliedLast);
    // Flip horizontally so horse faces LEFT!
    CGContextTranslateCTM(rctx, bw, 0);
    CGContextScaleCTM(rctx, -1, 1);
    CGContextDrawImage(rctx, CGRectMake(0, 0, bw, bh), baseImg);
    CGContextRelease(rctx); CGColorSpaceRelease(cs); CGImageRelease(baseImg);

    typedef struct { const char *f; double tr, tg, tb; bool grayFirst; uint32_t saddle, trim, aura; bool hasAura; } MH;
    MH mh[8] = {
        {"h_1.png", 1.95, 0.42, 0.32, false, 0xe8a825, 0xfff099, 0xff5a1f, true},  // 赤兔
        {"h_2.png", 1.78, 1.38, 0.62, false, 0x992820, 0xf2d16b, 0x000000, false}, // 黄骠
        {"h_3.png", 0.42, 0.45, 0.56, true,  0x8c1c1c, 0xdce6f2, 0x000000, false}, // 乌骓
        {"h_4.png", 0.78, 0.52, 0.44, false, 0x2c4b75, 0xd4bc6a, 0x8ea6cc, true},  // 绝影
        {"h_5.png", 2.55, 2.60, 2.75, true,  0x2665a8, 0x7ef0ff, 0x61c8ff, true},  // 的卢 (pure snow-white!)
        {"h_6.png", 2.35, 1.92, 0.68, true,  0xb5241b, 0xffe875, 0xffd23f, true},  // 爪黄飞电
        {"h_7.png", 2.15, 2.60, 2.85, true,  0x26598f, 0xfff499, 0x45e8ff, true},  // 白龙神驹 (silver-cyan!)
        {"h_8.png", 1.65, 0.34, 0.46, false, 0xd99b1e, 0xffffff, 0xff9e3d, true},  // 汗血天马
    };

    for (int i = 0; i < 8; i++) {
        Pix hp = pix_new(bw + 4, bh + 4);
        // Copy recolored horse pixels + compute crisp 1px dark outline
        for (int y = 0; y < bh; y++) {
            for (int x = 0; x < bw; x++) {
                int idx = (y * bw + x) * 4;
                uint8_t a = raw[idx+3];
                if (a < 30) continue;
                double r = raw[idx], g = raw[idx+1], b = raw[idx+2];
                // Preserve eye; tint coat
                double lum = 0.30 * r + 0.59 * g + 0.11 * b;
                uint8_t nr, ng, nb;
                if (b > r + 15 && lum > 80) {
                    nr = (uint8_t)r; ng = (uint8_t)g; nb = (uint8_t)b;
                } else if (mh[i].grayFirst) {
                    double base = fmin(255.0, lum * 1.15);
                    nr = (uint8_t)fmin(255, base * mh[i].tr * 0.48);
                    ng = (uint8_t)fmin(255, base * mh[i].tg * 0.48);
                    nb = (uint8_t)fmin(255, base * mh[i].tb * 0.48);
                } else {
                    nr = (uint8_t)fmin(255, r * mh[i].tr);
                    ng = (uint8_t)fmin(255, g * mh[i].tg);
                    nb = (uint8_t)fmin(255, b * mh[i].tb);
                }
                RGBA c = { nr, ng, nb, a };
                pix_set(&hp, x + 2, y + 2, c);
            }
        }
        // Add ornate Chinese battle saddle & golden bridle on the horse torso
        pix_rect(&hp, 19, 17, 13, 6, rgb(mh[i].saddle));
        pix_stroke(&hp, 19, 17, 13, 6, rgb(mh[i].trim));
        pix_rect(&hp, 21, 18, 9, 2, rgb(mh[i].trim));
        // Add crisp 1px outline around non-transparent silhouette
        Pix outlined = pix_new(hp.w, hp.h);
        RGBA outCol = rgb(0x140a08);
        for (int y = 1; y < hp.h - 1; y++) {
            for (int x = 1; x < hp.w - 1; x++) {
                if (hp.buf[(y * hp.w + x) * 4 + 3] > 30) {
                    int n4[4][2] = {{-1,0},{1,0},{0,-1},{0,1}};
                    for (int k=0;k<4;k++) {
                        int nx = x + n4[k][0], ny = y + n4[k][1];
                        if (hp.buf[(ny * hp.w + nx) * 4 + 3] <= 30) pix_set(&outlined, nx, ny, outCol);
                    }
                }
            }
        }
        for (int y = 0; y < hp.h; y++)
            for (int x = 0; x < hp.w; x++) {
                int idx = (y * hp.w + x) * 4;
                if (hp.buf[idx+3] > 30) {
                    RGBA c = { hp.buf[idx], hp.buf[idx+1], hp.buf[idx+2], hp.buf[idx+3] };
                    pix_set(&outlined, x, y, c);
                }
            }

        CGImageRef himg = pix_to_cgimage(&outlined);
        CGContextRef c = create_ctx(207, 203);
        draw_gradient(c, CGRectMake(0,0,207,203), rgb(0x4a1914), rgb(0x31100c), rgb(0x180706), true);
        if (mh[i].hasAura) {
            draw_radial_glow(c, CGPointMake(103.5, 101.5), 92, rgba_hex(mh[i].aura, 125), rgba_hex(mh[i].aura, 0));
        }
        CGColorRef bcg = cg_color(rgb(mh[i].hasAura ? 0xf5cc58 : 0xb08434));
        CGContextSetStrokeColorWithColor(c, bcg); CGContextSetLineWidth(c, 5.0);
        CGContextStrokeRect(c, CGRectMake(2.5,2.5,202,198)); CGColorRelease(bcg);
        CGContextSetInterpolationQuality(c, kCGInterpolationNone);
        CGContextDrawImage(c, CGRectMake(14, 34, 179, 136), himg);
        CGImageRef out = CGBitmapContextCreateImage(c);
        save_cgimage(out, [gOutRoot stringByAppendingPathComponent:[NSString stringWithUTF8String:mh[i].f]]);
        CGImageRelease(out); CGContextRelease(c); CGImageRelease(himg);
        pix_free(&hp); pix_free(&outlined);
    }
    free(raw);
}

// =========================================================================
// 7. SLICE AI-GENERATED APP ICON & 4x4 PORTRAITS SHEET
// =========================================================================
static void slice_ai_sheets(void) {
    CGImageRef appIcon = load_cgimage([gRawDir stringByAppendingPathComponent:@"app-icon.png"]);
    if (appIcon) {
        CGContextRef c = create_ctx(512, 512);
        CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
        CGContextDrawImage(c, CGRectMake(0, 0, 512, 512), appIcon);
        CGImageRef out = CGBitmapContextCreateImage(c);
        save_cgimage(out, gIconOut);
        CGImageRelease(out); CGContextRelease(c); CGImageRelease(appIcon);
    }
    CGImageRef sheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"portraits-sheet.png"]);
    if (sheet) {
        NSArray *names = @[
            @"portraits/ws1.png", @"portraits/ws2.png", @"portraits/ws3.png", @"portraits/ws4.png",
            @"portraits/wr1.png", @"portraits/wr2.png", @"portraits/wr3.png", @"portraits/wr4.png",
            @"portraits/wr5.png", @"portraits/wr6.png", @"portraits/yr1.png", @"portraits/yr2.png",
            @"portraits/yr4.png", @"", @"f000.png", @""
        ];
        double cw = CGImageGetWidth(sheet) / 4.0, ch = CGImageGetHeight(sheet) / 4.0;
        double ix = cw * 0.03, iy = ch * 0.03;
        for (int i = 0; i < (int)names.count; i++) {
            NSString *name = names[i];
            if (name.length == 0) continue;
            int col = i % 4, row = i / 4;
            CGRect cr = CGRectMake(round(col * cw + ix), round(row * ch + iy), round(cw - 2 * ix), round(ch - 2 * iy));
            CGImageRef crop = CGImageCreateWithImageInRect(sheet, cr);
            if (!crop) continue;
            CGContextRef c = create_ctx(64, 64);
            CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
            CGContextDrawImage(c, CGRectMake(0, 0, 64, 64), crop);
            CGImageRef out = CGBitmapContextCreateImage(c);
            save_cgimage(out, [gOutRoot stringByAppendingPathComponent:name]);
            CGImageRelease(out); CGContextRelease(c); CGImageRelease(crop);
        }
        CGImageRelease(sheet);
    }
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        gOutRoot = argc > 1 ? [NSString stringWithUTF8String:argv[1]] : @"/Users/villow/myProject/github/hxsg/apps/web/mapp/assets";
        gRawDir  = argc > 2 ? [NSString stringWithUTF8String:argv[2]] : @"/Users/villow/myProject/github/hxsg/apps/web/mapp/raw-sheets";
        gCc0Dir  = argc > 3 ? [NSString stringWithUTF8String:argv[3]] : @"/Users/villow/myProject/github/hxsg/apps/web/mapp/raw-cc0";
        gIconOut = argc > 4 ? [NSString stringWithUTF8String:argv[4]] : @"/Users/villow/myProject/github/hxsg/apps/web/mapp/icon.png";

        NSFileManager *fm = [NSFileManager defaultManager];
        [fm createDirectoryAtPath:[gOutRoot stringByAppendingPathComponent:@"portraits"] withIntermediateDirectories:YES attributes:nil error:nil];

        gen_sprites();
        gen_biomes();
        gen_vfx();
        gen_ui();
        gen_map_thumbs();
        gen_cc0_equipment_and_facilities();
        gen_cc0_mounts();
        slice_ai_sheets();

        printf("MAPP_ASSET_V2_OK -> %s\n", gOutRoot.UTF8String);
    }
    return 0;
}
