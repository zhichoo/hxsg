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
// 1. 3-PART CHARACTER SPRITES: CODEX AI CHIBI SPRITE SHEET -> _h / _b / _f
// =========================================================================
typedef struct {
    const char *key;
    int cls;
    int cellIdx; // 0..10 in battle-chars-sheet.png (4x3 transparent PNG)
    uint32_t slashCol;
} SpriteSpec;

static CGImageRef tight_alpha_crop(CGImageRef sheet, int cols, int rows, int cellIdx, int *outHeadRelCX) {
    double cellW = CGImageGetWidth(sheet) / (double)cols;
    double cellH = CGImageGetHeight(sheet) / (double)rows;
    int col = cellIdx % cols, row = cellIdx / cols;
    CGRect cellRect = CGRectMake(round(col * cellW), round(row * cellH), round(cellW), round(cellH));
    CGImageRef cell = CGImageCreateWithImageInRect(sheet, cellRect);
    if (!cell) return NULL;
    int cw = (int)CGImageGetWidth(cell), ch = (int)CGImageGetHeight(cell);
    uint8_t *buf = (uint8_t *)calloc((size_t)cw * (size_t)ch * 4, 1);
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGContextRef ctx = CGBitmapContextCreate(buf, cw, ch, 8, cw * 4, cs, kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(ctx, CGRectMake(0, 0, cw, ch), cell);
    CGContextRelease(ctx); CGColorSpaceRelease(cs);

    int minX = cw, minY = ch, maxX = -1, maxY = -1;
    for (int y = 2; y < ch - 2; y++) {
        for (int x = 2; x < cw - 2; x++) {
            uint8_t a = buf[(y * cw + x) * 4 + 3];
            if (a > 24) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX <= minX || maxY <= minY) { free(buf); return cell; }

    // Find horizontal center of mass of the head/body core (top 45%, excluding far-right weapon tips)
    int bh = maxY - minY + 1;
    double sumX = 0, sumW = 0;
    for (int y = minY; y < minY + (int)(bh * 0.48); y++) {
        for (int x = minX; x <= maxX; x++) {
            uint8_t a = buf[(y * cw + x) * 4 + 3];
            if (a > 60) { sumX += (x - minX); sumW += 1.0; }
        }
    }
    if (outHeadRelCX) {
        *outHeadRelCX = sumW > 0 ? (int)round(sumX / sumW) : (maxX - minX) / 2;
    }
    free(buf);

    int pad = 2;
    minX = minX > pad ? minX - pad : 0;
    minY = minY > pad ? minY - pad : 0;
    maxX = (maxX + pad < cw) ? maxX + pad : cw - 1;
    maxY = (maxY + pad < ch) ? maxY + pad : ch - 1;
    if (outHeadRelCX) *outHeadRelCX += pad;

    CGImageRef tight = CGImageCreateWithImageInRect(cell, CGRectMake(minX, minY, maxX - minX + 1, maxY - minY + 1));
    CGImageRelease(cell);
    return tight;
}

static void gen_sprites(void) {
    SpriteSpec specs[] = {
        {"r1",  1,  0, 0x8ad8ff}, // young male warrior (cobalt/silver spear)
        {"r1n", 1,  1, 0xff8c52}, // young female warrior (crimson/gold halberd)
        {"r2",  2,  2, 0xc8f4ff}, // male strategist (teal/feather fan)
        {"r2n", 2,  3, 0x7effc4}, // female strategist (emerald/jade fan)
        {"r3",  3,  4, 0x72ffb8}, // male mystic (taoist jade staff)
        {"r3n", 3,  5, 0xff8cf2}, // female mystic (magenta magic staff)
        {"n1",  1,  6, 0xffc864}, // enemy bandit warrior (iron saber)
        {"n2",  2,  7, 0xd8f08a}, // enemy male strategist (scroll)
        {"n2n", 2,  8, 0xff8ca8}, // enemy female strategist (fan)
        {"n3",  3,  9, 0xffe464}, // yellow turban sorcerer (talisman staff)
        {"n3n", 3, 10, 0xc47cff}, // enemy violet priestess (flame wand)
    };
    CGImageRef charSheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"battle-chars-sheet.png"]);
    if (!charSheet) { fprintf(stderr, "Missing battle-chars-sheet.png!\n"); return; }

    int count = (int)(sizeof(specs) / sizeof(specs[0]));
    for (int i = 0; i < count; i++) {
        SpriteSpec s = specs[i];
        int headRelCX = 0;
        CGImageRef tight = tight_alpha_crop(charSheet, 4, 3, s.cellIdx, &headRelCX);
        if (!tight) continue;

        // Exact CLASS_SPRITE_RIG anchors in BattleStage.tsx (feet at y = totalH, top of head at y = 0)
        // Class 1 hi-DPI MAPP uses widened 72-logical-px body (34 idle [-17..+17] + 38 atk [-11..+27]) so full-height spears/sabers never clip!
        int totalH, headH = 21, bodyTopY, bodyH, bodyW, bodyIdleW, bodyIdleDx, bodyAtkX, bodyAtkW, bodyAtkDx;
        int legW, legH, legIdleW, legAtkX, legAtkW;
        if (s.cls == 1) {
            totalH = 36; bodyTopY = 17; bodyH = 15; bodyW = 72;
            bodyIdleW = 34; bodyIdleDx = -17; bodyAtkX = 34; bodyAtkW = 38; bodyAtkDx = -11;
            legW = 37; legH = 10; legIdleW = 18; legAtkX = 18; legAtkW = 19;
        } else if (s.cls == 2) {
            totalH = 34; bodyTopY = 17; bodyH = 16; bodyW = 61;
            bodyIdleW = 23; bodyIdleDx = -10; bodyAtkX = 23; bodyAtkW = 38; bodyAtkDx = -10;
            legW = 28; legH = 9; legIdleW = 14; legAtkX = 14; legAtkW = 14;
        } else {
            totalH = 34; bodyTopY = 16; bodyH = 15; bodyW = 67;
            bodyIdleW = 31; bodyIdleDx = -11; bodyAtkX = 31; bodyAtkW = 36; bodyAtkDx = -11;
            legW = 28; legH = 8; legIdleW = 14; legAtkX = 14; legAtkW = 14;
        }

        // Render full-body chibi at 4x hi-DPI Retina resolution — FULL 100% height for ALL classes!
        const int S = 4;
        int vw = 64 * S, vh = totalH * S, vOriginX = 32 * S;
        double tw = CGImageGetWidth(tight), th = CGImageGetHeight(tight);
        double scale = (double)vh / th;
        double dw = tw * scale;
        double dh = vh;
        double drawX = vOriginX - headRelCX * scale;

        uint8_t *vbuf = (uint8_t *)calloc((size_t)vw * (size_t)vh * 4, 1);
        CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
        CGContextRef vctx = CGBitmapContextCreate(vbuf, vw, vh, 8, vw * 4, cs, kCGImageAlphaPremultipliedLast);
        CGContextSetInterpolationQuality(vctx, kCGInterpolationHigh);
        CGContextDrawImage(vctx, CGRectMake(drawX, 0, dw, dh), tight);
        CGContextRelease(vctx);

        // Seamless cut lines in hi-DPI pixels
        int headCutBottom = (bodyTopY + 1) * S;
        int bodyCutBottom = (totalH - legH + 2) * S;

        // 1) HEAD (_h.png, 84x84 = 4x of 21x21)
        Pix hp = pix_new(21 * S, headH * S);
        int headOffsetX = 0;
        for (int y = 0; y < headH * S && y <= headCutBottom && y < vh; y++) {
            for (int x = 0; x < 21 * S; x++) {
                int vx = vOriginX - 10 * S + x + headOffsetX;
                if (vx < 0 || vx >= vw) continue;
                int idx = (y * vw + vx) * 4;
                uint8_t a = vbuf[idx+3];
                if (a < 28) continue;
                RGBA c = {
                    (uint8_t)fmin(255, vbuf[idx]   * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+1] * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+2] * 255 / a),
                    a
                };
                pix_set(&hp, x, y, c);
            }
        }
        pix_save(&hp, [NSString stringWithFormat:@"%s_h.png", s.key]);
        pix_free(&hp);

        // 2) BODY (_b.png, 4x hi-DPI): left = bodyIdle, right = bodyAtk shifted forward + glowing crescent slash
        Pix bp = pix_new(bodyW * S, bodyH * S);
        for (int y = 0; y < bodyH * S; y++) {
            int vy = bodyTopY * S + y;
            if (vy < 0 || vy >= vh || vy > bodyCutBottom) continue;
            for (int x = 0; x < bodyIdleW * S; x++) {
                int vx = vOriginX + bodyIdleDx * S + x;
                if (vx < 0 || vx >= vw) continue;
                int idx = (vy * vw + vx) * 4;
                uint8_t a = vbuf[idx+3];
                if (a < 28) continue;
                RGBA c = {
                    (uint8_t)fmin(255, vbuf[idx]   * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+1] * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+2] * 255 / a),
                    a
                };
                pix_set(&bp, x, y, c);
            }
        }
        for (int y = 0; y < bodyH * S; y++) {
            int vy = bodyTopY * S + y;
            if (vy < 0 || vy >= vh || vy > bodyCutBottom) continue;
            for (int x = 0; x < bodyAtkW * S; x++) {
                int vx = vOriginX + bodyAtkDx * S + x - 4 * S;
                if (vx < 0 || vx >= vw) continue;
                int idx = (vy * vw + vx) * 4;
                uint8_t a = vbuf[idx+3];
                if (a < 28) continue;
                RGBA c = {
                    (uint8_t)fmin(255, vbuf[idx]   * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+1] * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+2] * 255 / a),
                    a
                };
                pix_set(&bp, bodyAtkX * S + x, y, c);
            }
        }
        // Smooth crisp weapon slash arc cleanly inside right side of 4x attack frame
        int arcCX = (bodyAtkX + bodyAtkW - 13) * S;
        RGBA sc1 = rgba_hex(s.slashCol, 210);
        RGBA sc2 = rgba_hex(0xffffff, 245);
        for (int a = -52; a <= 52; a += 2) {
            double rad = a * M_PI / 180.0;
            int px = arcCX + (int)round(cos(rad) * 6.0 * S);
            int py = (bodyH * S) / 2 + (int)round(sin(rad) * (bodyH * S * 0.42));
            if (px >= bodyAtkX * S + 2 && px < (bodyAtkX + bodyAtkW) * S - 3 && py >= 2 && py < bodyH * S - 3) {
                pix_circle(&bp, px, py, 3, sc1);
                pix_circle(&bp, px, py, 1, sc2);
            }
        }
        pix_save(&bp, [NSString stringWithFormat:@"%s_b.png", s.key]);
        pix_free(&bp);

        // 3) LEGS (_f.png, 4x hi-DPI)
        Pix fp = pix_new(legW * S, legH * S);
        for (int y = 0; y < legH * S; y++) {
            int vy = vh - legH * S + y;
            if (vy < 0 || vy >= vh) continue;
            for (int x = 0; x < legIdleW * S; x++) {
                int vx = vOriginX - (legIdleW * S) / 2 + x + headOffsetX;
                if (vx < 0 || vx >= vw) continue;
                int idx = (vy * vw + vx) * 4;
                uint8_t a = vbuf[idx+3];
                if (a < 28) continue;
                RGBA c = {
                    (uint8_t)fmin(255, vbuf[idx]   * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+1] * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+2] * 255 / a),
                    a
                };
                pix_set(&fp, x, y, c);
            }
            for (int x = 0; x < legAtkW * S; x++) {
                double rel = (double)(x - (legAtkW * S) / 2) * 0.90;
                int vx = vOriginX + (int)round(rel) - 1 * S + headOffsetX;
                if (vx < 0 || vx >= vw) continue;
                int idx = (vy * vw + vx) * 4;
                uint8_t a = vbuf[idx+3];
                if (a < 28) continue;
                RGBA c = {
                    (uint8_t)fmin(255, vbuf[idx]   * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+1] * 255 / a),
                    (uint8_t)fmin(255, vbuf[idx+2] * 255 / a),
                    a
                };
                pix_set(&fp, legAtkX * S + x, y, c);
            }
        }
        pix_save(&fp, [NSString stringWithFormat:@"%s_f.png", s.key]);
        pix_free(&fp);

        free(vbuf);
        CGColorSpaceRelease(cs);
        CGImageRelease(tight);
    }
    CGImageRelease(charSheet);
}

// =========================================================================
// 2. CODEX AI 16-BIT PIXEL BATTLEFIELD PANORAMAS (ZERO SVG / ZERO VECTOR!)
// =========================================================================
typedef struct {
    const char *prefix;
    int sheetNum; // 1 = battle-bgs-1.png, 2 = battle-bgs-2.png
    int bandIdx;  // 0..3 top-to-bottom
    uint32_t tintOverlay;
    uint8_t tintAlpha;
} BiomeSpec;

static void gen_biomes(void) {
    BiomeSpec biomes[] = {
        {"f_bg2",  1, 0, 0x000000,  0}, // 许昌绿野城垣
        {"f_bg4",  1, 1, 0xf290b5, 22}, // 桃园花林
        {"f_bg5",  1, 2, 0xc97b28, 28}, // 秋山古垒
        {"f_bg6",  1, 3, 0x6b604e, 24}, // 洛阳皇城
        {"f_bg7",  2, 0, 0x5c4c38, 28}, // 虎牢险关
        {"f_bg8",  2, 1, 0xb89352, 42}, // 荒漠军营
        {"f_bg9",  2, 2, 0x3d2e4d, 38}, // 暮江古渡
        {"f_bg20", 2, 3, 0x9e2a14, 58}, // 赤壁火海
    };
    CGImageRef bg1 = load_cgimage([gRawDir stringByAppendingPathComponent:@"battle-bgs-1.png"]);
    CGImageRef bg2 = load_cgimage([gRawDir stringByAppendingPathComponent:@"battle-bgs-2.png"]);
    CGImageRef props = load_cgimage([gRawDir stringByAppendingPathComponent:@"battle-props-sheet.png"]);
    CGImageRef ridgeProp = props ? tight_alpha_crop(props, 2, 2, 3, NULL) : NULL;
    CGImageRef rockProp  = props ? tight_alpha_crop(props, 2, 2, 2, NULL) : NULL;
    CGImageRef bush1Prop = props ? tight_alpha_crop(props, 2, 2, 0, NULL) : NULL;
    CGImageRef bush2Prop = props ? tight_alpha_crop(props, 2, 2, 1, NULL) : NULL;

    // Save battlefield flowering pixel bushes f_bg_c.png (124x108) & f_bg_c2.png (116x80) at 4x hi-DPI!
    if (bush1Prop) {
        CGContextRef c = create_ctx(124, 108);
        CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
        double iw = CGImageGetWidth(bush1Prop), ih = CGImageGetHeight(bush1Prop);
        double s = fmin(118.0 / iw, 102.0 / ih);
        CGContextDrawImage(c, CGRectMake((124 - iw*s)/2.0, (108 - ih*s)/2.0, iw*s, ih*s), bush1Prop);
        CGImageRef out = CGBitmapContextCreateImage(c);
        save_cgimage(out, [gOutRoot stringByAppendingPathComponent:@"f_bg_c.png"]);
        CGImageRelease(out); CGContextRelease(c);
    }
    if (bush2Prop) {
        CGContextRef c = create_ctx(116, 80);
        CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
        double iw = CGImageGetWidth(bush2Prop), ih = CGImageGetHeight(bush2Prop);
        double s = fmin(110.0 / iw, 74.0 / ih);
        CGContextDrawImage(c, CGRectMake((116 - iw*s)/2.0, (80 - ih*s)/2.0, iw*s, ih*s), bush2Prop);
        CGImageRef out = CGBitmapContextCreateImage(c);
        save_cgimage(out, [gOutRoot stringByAppendingPathComponent:@"f_bg_c2.png"]);
        CGImageRelease(out); CGContextRelease(c);
    }

    int n = (int)(sizeof(biomes) / sizeof(biomes[0]));
    for (int i = 0; i < n; i++) {
        BiomeSpec b = biomes[i];
        CGImageRef srcSheet = (b.sheetNum == 1) ? bg1 : bg2;
        if (!srcSheet) continue;
        double sw = CGImageGetWidth(srcSheet);
        double bandH = CGImageGetHeight(srcSheet) / 4.0;
        // Trim 3px off top/bottom of each band so adjacent bands never bleed a 1px seam
        CGRect bandRect = CGRectMake(0, round(b.bandIdx * bandH) + 3, sw, round(bandH) - 6);
        CGImageRef bandImg = CGImageCreateWithImageInRect(srcSheet, bandRect);
        if (!bandImg) continue;

        // Top horizon panorama (840x160 -> split into 420x160 _5.png & _6.png hi-DPI Retina!)
        // Smoothly blends bottom 18px into the #bca96b sandy battlefield floor
        CGContextRef tc = create_ctx(840, 160);
        CGContextSetInterpolationQuality(tc, kCGInterpolationHigh);
        CGContextDrawImage(tc, CGRectMake(0, 0, 840, 160), bandImg);
        draw_gradient(tc, CGRectMake(0, 0, 840, 16), rgba_hex(0xbca96b, 0), rgba_hex(0xbca96b, 120), rgba_hex(0xbca96b, 255), true);
        CGImageRef fullTop = CGBitmapContextCreateImage(tc);
        CGImageRef left5  = CGImageCreateWithImageInRect(fullTop, CGRectMake(0, 0, 420, 160));
        CGImageRef right6 = CGImageCreateWithImageInRect(fullTop, CGRectMake(420, 0, 420, 160));
        save_cgimage(left5,  [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_5.png", b.prefix]]);
        save_cgimage(right6, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_6.png", b.prefix]]);
        CGImageRelease(left5); CGImageRelease(right6); CGImageRelease(fullTop); CGContextRelease(tc);

        // Bottom foreground border (840x84 -> split into 420x84 _3.png & _4.png hi-DPI Retina!)
        // Transparent top edge so irregular hand-pixelled grass & rocks blend seamlessly onto #bca96b with ZERO seam or hard bar!
        CGContextRef bc = create_ctx(840, 84);
        CGContextSetInterpolationQuality(bc, kCGInterpolationHigh);
        // Asymmetric, continuous overlapping placement across x=0..840 (crosses the x=420 split smoothly with ZERO center mirror seam!)
        if (ridgeProp) {
            double rx[5] = {-28, 140, 325, 515, 675};
            double rw[5] = {240, 235, 250, 230, 220};
            double rh[5] = {74,  66,  72,  68,  76};
            double ry[5] = {-8,  -12, -6,  -10, -8};
            bool   rf[5] = {false, false, true, false, true};
            for (int p = 0; p < 5; p++) {
                CGContextSaveGState(bc);
                double ox = rx[p] + ((i * 19 + p * 7) % 15) - 7;
                if (rf[p]) {
                    CGContextTranslateCTM(bc, ox + rw[p], 0);
                    CGContextScaleCTM(bc, -1, 1);
                    CGContextDrawImage(bc, CGRectMake(0, ry[p], rw[p], rh[p]), ridgeProp);
                } else {
                    CGContextDrawImage(bc, CGRectMake(ox, ry[p], rw[p], rh[p]), ridgeProp);
                }
                CGContextRestoreGState(bc);
            }
        }
        if (rockProp) {
            CGContextDrawImage(bc, CGRectMake(88 + (i * 17) % 40, -2, 64, 48), rockProp);
            CGContextDrawImage(bc, CGRectMake(575 - (i * 23) % 45, -4, 60, 44), rockProp);
        }
        if (bush2Prop) {
            CGContextDrawImage(bc, CGRectMake(398 + (i * 11) % 24, -6, 54, 42), bush2Prop);
        }
        // Subtle biome mood tint ONLY on non-transparent foliage pixels (kCGBlendModeSourceAtop keeps top edge 100% transparent!)
        if (b.tintAlpha > 0) {
            CGContextSaveGState(bc);
            CGContextSetBlendMode(bc, kCGBlendModeSourceAtop);
            CGColorRef tcCol = cg_color(rgba_hex(b.tintOverlay, b.tintAlpha));
            CGContextSetFillColorWithColor(bc, tcCol);
            CGContextFillRect(bc, CGRectMake(0, 0, 840, 84));
            CGColorRelease(tcCol);
            CGContextRestoreGState(bc);
        }

        CGImageRef fullBot = CGBitmapContextCreateImage(bc);
        CGImageRef left3  = CGImageCreateWithImageInRect(fullBot, CGRectMake(0, 0, 420, 84));
        CGImageRef right4 = CGImageCreateWithImageInRect(fullBot, CGRectMake(420, 0, 420, 84));
        save_cgimage(left3,  [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_3.png", b.prefix]]);
        save_cgimage(right4, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"%s_4.png", b.prefix]]);
        CGImageRelease(left3); CGImageRelease(right4); CGImageRelease(fullBot); CGContextRelease(bc);
        CGImageRelease(bandImg);
    }

    if (ridgeProp) CGImageRelease(ridgeProp);
    if (rockProp)  CGImageRelease(rockProp);
    if (bush1Prop) CGImageRelease(bush1Prop);
    if (bush2Prop) CGImageRelease(bush2Prop);
    if (props)     CGImageRelease(props);
    if (bg1)       CGImageRelease(bg1);
    if (bg2)       CGImageRelease(bg2);
}

// =========================================================================
// 3. CODEX AI GLOWING BATTLE VFX + PIXEL NUMBERS & STATUS GLYPHS
// =========================================================================
// Extract a luminous VFX cell from pure-black background using smooth max-channel alpha + tight bbox crop
static CGImageRef extract_black_bg_vfx(CGImageRef sheet, int cols, int rows, int cellIdx) {
    double cellW = CGImageGetWidth(sheet) / (double)cols;
    double cellH = CGImageGetHeight(sheet) / (double)rows;
    int col = cellIdx % cols, row = cellIdx / cols;
    CGRect cellRect = CGRectMake(round(col * cellW), round(row * cellH), round(cellW), round(cellH));
    CGImageRef cell = CGImageCreateWithImageInRect(sheet, cellRect);
    if (!cell) return NULL;
    int cw = (int)CGImageGetWidth(cell), ch = (int)CGImageGetHeight(cell);
    uint8_t *buf = (uint8_t *)calloc((size_t)cw * (size_t)ch * 4, 1);
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGContextRef ctx = CGBitmapContextCreate(buf, cw, ch, 8, cw * 4, cs, kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(ctx, CGRectMake(0, 0, cw, ch), cell);
    CGContextRelease(ctx); CGImageRelease(cell);

    int minX = cw, minY = ch, maxX = -1, maxY = -1;
    uint8_t *outBuf = (uint8_t *)calloc((size_t)cw * (size_t)ch * 4, 1);
    for (int y = 2; y < ch - 2; y++) {
        for (int x = 2; x < cw - 2; x++) {
            int idx = (y * cw + x) * 4;
            int r = buf[idx], g = buf[idx+1], b = buf[idx+2];
            int m = r > g ? (r > b ? r : b) : (g > b ? g : b);
            if (m <= 16) continue;
            double a = (m - 16) / 239.0;
            double aBoost = pow(a, 0.72);
            if (aBoost > 1.0) aBoost = 1.0;
            uint8_t ua = (uint8_t)round(aBoost * 255.0);
            // Boost vividness while keeping premultiplied-safe unpremultiplied values
            double inv = 1.0 / fmax(0.25, a);
            outBuf[idx]   = (uint8_t)fmin(255.0, r * inv);
            outBuf[idx+1] = (uint8_t)fmin(255.0, g * inv);
            outBuf[idx+2] = (uint8_t)fmin(255.0, b * inv);
            outBuf[idx+3] = ua;
            if (ua > 24) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    free(buf);
    if (maxX <= minX || maxY <= minY) { free(outBuf); CGColorSpaceRelease(cs); return NULL; }

    int tw = maxX - minX + 1, th = maxY - minY + 1;
    Pix p = pix_new(tw, th);
    for (int y = 0; y < th; y++) {
        memcpy(p.buf + (size_t)y * tw * 4, outBuf + (size_t)(minY + y) * cw * 4 + (size_t)minX * 4, (size_t)tw * 4);
    }
    free(outBuf); CGColorSpaceRelease(cs);
    CGImageRef res = pix_to_cgimage(&p);
    pix_free(&p);
    return res;
}

static void draw_vfx_in_rect(CGContextRef ctx, CGImageRef img, CGRect box, double scaleMult, bool flipX, double rotDeg, CGFloat alpha) {
    if (!img) return;
    double iw = CGImageGetWidth(img), ih = CGImageGetHeight(img);
    double s = fmin(box.size.width / iw, box.size.height / ih) * scaleMult;
    double dw = iw * s, dh = ih * s;
    CGContextSaveGState(ctx);
    CGContextClipToRect(ctx, box);
    CGContextSetAlpha(ctx, alpha);
    CGContextTranslateCTM(ctx, CGRectGetMidX(box), CGRectGetMidY(box));
    if (rotDeg != 0.0) CGContextRotateCTM(ctx, rotDeg * M_PI / 180.0);
    if (flipX) CGContextScaleCTM(ctx, -1.0, 1.0);
    CGContextSetInterpolationQuality(ctx, kCGInterpolationHigh);
    CGContextDrawImage(ctx, CGRectMake(-dw / 2.0, -dh / 2.0, dw, dh), img);
    CGContextRestoreGState(ctx);
}

static void gen_vfx(void) {
    CGImageRef vfxSheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"battle-vfx-sheet.png"]);
    CGImageRef vfx[12] = {0};
    if (vfxSheet) {
        for (int i = 0; i < 12; i++) vfx[i] = extract_black_bg_vfx(vfxSheet, 4, 3, i);
        CGImageRelease(vfxSheet);
    }
    // Export combat VFX at 3x hi-DPI Retina resolution (BattleStage auto-scales via srcRes = img.height / sh!)
    const int V = 3;

    // 1) f_sd.png (3x of 96x71 = 288x213)
    CGContextRef sdc = create_ctx(96 * V, 71 * V);
    draw_vfx_in_rect(sdc, vfx[0], CGRectMake(0 * V, 0, 36 * V, 71 * V), 1.05, false, 0, 1.0);
    draw_vfx_in_rect(sdc, vfx[1], CGRectMake(36 * V, 0, 33 * V, 71 * V), 1.05, false, 0, 1.0);
    draw_vfx_in_rect(sdc, vfx[0], CGRectMake(69 * V, 0, 27 * V, 71 * V), 1.08, true, 0, 0.95);
    CGImageRef sdImg = CGBitmapContextCreateImage(sdc);
    save_cgimage(sdImg, [gOutRoot stringByAppendingPathComponent:@"f_sd.png"]);
    CGImageRelease(sdImg); CGContextRelease(sdc);

    // 2) fire.png (3x of 66x44 = 198x132)
    CGContextRef fc = create_ctx(66 * V, 44 * V);
    draw_vfx_in_rect(fc, vfx[2],  CGRectMake(0 * V, 0, 25 * V, 44 * V), 1.02, false, 0, 1.0);
    draw_vfx_in_rect(fc, vfx[11], CGRectMake(25 * V, 0, 20 * V, 44 * V), 1.05, false, 0, 1.0);
    draw_vfx_in_rect(fc, vfx[2],  CGRectMake(45 * V, 0, 21 * V, 44 * V), 1.05, true, 0, 0.95);
    CGImageRef fiImg = CGBitmapContextCreateImage(fc);
    save_cgimage(fiImg, [gOutRoot stringByAppendingPathComponent:@"fire.png"]);
    CGImageRelease(fiImg); CGContextRelease(fc);

    // 3) dead_fl.png (3x of 111x43 = 333x129)
    CGContextRef dfc = create_ctx(111 * V, 43 * V);
    int dx[4] = {0, 31, 61, 93}, dw[4] = {31, 30, 32, 18};
    double dsc[4] = {0.95, 1.05, 1.0, 0.92};
    for (int i = 0; i < 4; i++) {
        draw_vfx_in_rect(dfc, vfx[7], CGRectMake(dx[i] * V, 0, dw[i] * V, 43 * V), dsc[i], (i % 2 == 1), 0, 1.0);
    }
    CGImageRef dfImg = CGBitmapContextCreateImage(dfc);
    save_cgimage(dfImg, [gOutRoot stringByAppendingPathComponent:@"dead_fl.png"]);
    CGImageRelease(dfImg); CGContextRelease(dfc);

    // 4) fg.png (3x of 92x68 = 276x204)
    CGContextRef fgc = create_ctx(92 * V, 68 * V);
    draw_vfx_in_rect(fgc, vfx[3], CGRectMake(27 * V, 0, 65 * V, 68 * V), 0.98, false, 0, 1.0);
    CGImageRef fgImg = CGBitmapContextCreateImage(fgc);
    save_cgimage(fgImg, [gOutRoot stringByAppendingPathComponent:@"fg.png"]);
    CGImageRelease(fgImg); CGContextRelease(fgc);

    // 5) fg2.png (3x of 104x28 = 312x84)
    CGContextRef fg2c = create_ctx(104 * V, 28 * V);
    int g2[4][2] = {{0,24},{26,28},{54,22},{78,25}};
    double g2s[4] = {0.88, 1.04, 0.96, 0.85};
    for (int i = 0; i < 4; i++) {
        draw_vfx_in_rect(fg2c, vfx[4], CGRectMake(g2[i][0] * V, 0, g2[i][1] * V, 28 * V), g2s[i], (i % 2 == 1), 0, 1.0);
    }
    CGImageRef fg2Img = CGBitmapContextCreateImage(fg2c);
    save_cgimage(fg2Img, [gOutRoot stringByAppendingPathComponent:@"fg2.png"]);
    CGImageRelease(fg2Img); CGContextRelease(fg2c);

    // 6) fg3.png (3x of 166x33 = 498x99)
    CGContextRef fg3c = create_ctx(166 * V, 33 * V);
    int g3[5][2] = {{0,39},{40,37},{78,34},{114,24},{139,27}};
    for (int i = 0; i < 5; i++) {
        draw_vfx_in_rect(fg3c, vfx[5], CGRectMake(g3[i][0] * V, 0, g3[i][1] * V, 33 * V), 0.95, false, i * 36.0, 1.0);
    }
    CGImageRef fg3Img = CGBitmapContextCreateImage(fg3c);
    save_cgimage(fg3Img, [gOutRoot stringByAppendingPathComponent:@"fg3.png"]);
    CGImageRelease(fg3Img); CGContextRelease(fg3c);

    // 7) pi_fl.png (3x of 86x35 = 258x105)
    CGContextRef pic = create_ctx(86 * V, 35 * V);
    int p3[3][2] = {{0,30},{30,32},{62,24}};
    double p3s[3] = {0.92, 1.04, 0.96};
    for (int i = 0; i < 3; i++) {
        draw_vfx_in_rect(pic, vfx[6], CGRectMake(p3[i][0] * V, 0, p3[i][1] * V, 35 * V), p3s[i], (i == 2), 0, 1.0);
    }
    CGImageRef piImg = CGBitmapContextCreateImage(pic);
    save_cgimage(piImg, [gOutRoot stringByAppendingPathComponent:@"pi_fl.png"]);
    CGImageRelease(piImg); CGContextRelease(pic);

    // 8) blood.png (3x of 38x22 = 114x66)
    CGContextRef blc = create_ctx(38 * V, 22 * V);
    draw_vfx_in_rect(blc, vfx[8], CGRectMake(0, 0, 22 * V, 22 * V), 1.0, false, 0, 1.0);
    draw_vfx_in_rect(blc, vfx[8], CGRectMake(23 * V, 0, 15 * V, 22 * V), 1.05, true, 15.0, 0.95);
    CGImageRef blImg = CGBitmapContextCreateImage(blc);
    save_cgimage(blImg, [gOutRoot stringByAppendingPathComponent:@"blood.png"]);
    CGImageRelease(blImg); CGContextRelease(blc);

    // 9) smoke.png (3x of 60x12 = 180x36)
    CGContextRef smc = create_ctx(60 * V, 12 * V);
    int s3[3][2] = {{0,20},{22,17},{41,17}};
    double s3a[3] = {1.0, 0.85, 0.65};
    for (int i = 0; i < 3; i++) {
        draw_vfx_in_rect(smc, vfx[9], CGRectMake(s3[i][0] * V, 0, s3[i][1] * V, 12 * V), 1.0, (i == 1), 0, s3a[i]);
    }
    CGImageRef smImg = CGBitmapContextCreateImage(smc);
    save_cgimage(smImg, [gOutRoot stringByAppendingPathComponent:@"smoke.png"]);
    CGImageRelease(smImg); CGContextRelease(smc);

    // 10) dead_1.png (3x of 31x16 = 93x48): moss-covered carved Han gravestone
    CGImageRef charSheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"battle-chars-sheet.png"]);
    if (charSheet) {
        CGImageRef tomb = tight_alpha_crop(charSheet, 4, 3, 11, NULL);
        CGContextRef dc = create_ctx(31 * V, 16 * V);
        draw_vfx_in_rect(dc, tomb, CGRectMake(0, 0, 31 * V, 16 * V), 1.0, false, 0, 1.0);
        CGImageRef dImg = CGBitmapContextCreateImage(dc);
        save_cgimage(dImg, [gOutRoot stringByAppendingPathComponent:@"dead_1.png"]);
        CGImageRelease(dImg); CGContextRelease(dc);
        if (tomb) CGImageRelease(tomb);
        CGImageRelease(charSheet);
    }

    Pix yz = pix_new(12, 9); pix_circle(&yz, 6, 4, 4, rgba_hex(0x000000,110));
    pix_save(&yz, @"yz.png"); pix_free(&yz);

    CGContextRef wzCtx = create_ctx(50, 26);
    draw_outlined_text(wzCtx, @"闪", 25.0, 13.0, @"STHeitiSC-Medium", 22, rgb(0xfff199), rgb(0x1a0a00), 2.5);
    CGImageRef wzImg = CGBitmapContextCreateImage(wzCtx);
    save_cgimage(wzImg, [gOutRoot stringByAppendingPathComponent:@"wz.png"]);
    CGImageRelease(wzImg); CGContextRelease(wzCtx);

    // 11) f_jt.png (100x100): ornate glowing golden RPG downward target arrow
    CGContextRef jtc = create_ctx(100, 100);
    draw_vfx_in_rect(jtc, vfx[10], CGRectMake(0, 0, 100, 100), 0.96, false, 0, 1.0);
    CGImageRef jtImg = CGBitmapContextCreateImage(jtc);
    save_cgimage(jtImg, [gOutRoot stringByAppendingPathComponent:@"f_jt.png"]);
    CGImageRelease(jtImg); CGContextRelease(jtc);

    for (int i = 0; i < 12; i++) if (vfx[i]) CGImageRelease(vfx[i]);

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

// Helper: find tight foreground bbox of a uniform-background AI sheet cell, then frame it cleanly
static CGImageRef tight_crop_cell(CGImageRef sheet, CGRect cellRect, RGBA *outBg) {
    CGImageRef cell = CGImageCreateWithImageInRect(sheet, cellRect);
    if (!cell) return NULL;
    int cw = (int)CGImageGetWidth(cell), ch = (int)CGImageGetHeight(cell);
    uint8_t *buf = (uint8_t *)calloc((size_t)cw * (size_t)ch * 4, 1);
    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGContextRef ctx = CGBitmapContextCreate(buf, cw, ch, 8, cw * 4, cs, kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(ctx, CGRectMake(0, 0, cw, ch), cell);
    CGContextRelease(ctx); CGColorSpaceRelease(cs);

    // Sample 4 corners to get robust uniform background color
    int corners[4][2] = {{2,2}, {cw-3,2}, {2,ch-3}, {cw-3,ch-3}};
    int sr = 0, sg = 0, sb = 0;
    for (int k = 0; k < 4; k++) {
        int idx = (corners[k][1] * cw + corners[k][0]) * 4;
        sr += buf[idx]; sg += buf[idx+1]; sb += buf[idx+2];
    }
    uint8_t bgR = (uint8_t)(sr / 4), bgG = (uint8_t)(sg / 4), bgB = (uint8_t)(sb / 4);
    if (outBg) { outBg->r = bgR; outBg->g = bgG; outBg->b = bgB; outBg->a = 255; }

    int minX = cw, minY = ch, maxX = -1, maxY = -1;
    for (int y = 2; y < ch - 2; y++) {
        for (int x = 2; x < cw - 2; x++) {
            int idx = (y * cw + x) * 4;
            int dr = abs((int)buf[idx] - (int)bgR);
            int dg = abs((int)buf[idx+1] - (int)bgG);
            int db = abs((int)buf[idx+2] - (int)bgB);
            if (dr + dg + db > 28) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    free(buf);
    if (maxX <= minX || maxY <= minY) return cell;

    int pad = 6;
    minX = minX > pad ? minX - pad : 0;
    minY = minY > pad ? minY - pad : 0;
    maxX = (maxX + pad < cw) ? maxX + pad : cw - 1;
    maxY = (maxY + pad < ch) ? maxY + pad : ch - 1;

    CGImageRef tight = CGImageCreateWithImageInRect(cell, CGRectMake(minX, minY, maxX - minX + 1, maxY - minY + 1));
    CGImageRelease(cell);
    return tight;
}

static void save_framed_ai_cell(CGImageRef sheet, int cols, int rows, int cellIdx, int outW, int outH, int pad, RGBA borderCol, CGFloat borderW, NSString *outRel) {
    double cellW = CGImageGetWidth(sheet) / (double)cols;
    double cellH = CGImageGetHeight(sheet) / (double)rows;
    int col = cellIdx % cols, row = cellIdx / cols;
    CGRect cellRect = CGRectMake(round(col * cellW), round(row * cellH), round(cellW), round(cellH));

    RGBA bg = rgb(0x180c12);
    CGImageRef tight = tight_crop_cell(sheet, cellRect, &bg);
    if (!tight) return;

    CGContextRef c = create_ctx(outW, outH);
    CGColorRef bgCG = cg_color(bg);
    CGContextSetFillColorWithColor(c, bgCG);
    CGContextFillRect(c, CGRectMake(0, 0, outW, outH));
    CGColorRelease(bgCG);

    double tw = CGImageGetWidth(tight), th = CGImageGetHeight(tight);
    double scale = fmin((double)(outW - pad * 2) / tw, (double)(outH - pad * 2) / th);
    double dw = round(tw * scale), dh = round(th * scale);
    double dx = round((outW - dw) / 2.0), dy = round((outH - dh) / 2.0);
    CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
    CGContextDrawImage(c, CGRectMake(dx, dy, dw, dh), tight);
    CGImageRelease(tight);

    // Subtle inner highlight + ornate gold border
    CGColorRef bcg = cg_color(borderCol);
    CGContextSetStrokeColorWithColor(c, bcg);
    CGContextSetLineWidth(c, borderW);
    CGContextStrokeRect(c, CGRectMake(borderW / 2.0, borderW / 2.0, outW - borderW, outH - borderW));
    CGColorRelease(bcg);

    if (borderW >= 3.0) {
        CGColorRef icg = cg_color(rgba_hex(0xffffff, 38));
        CGContextSetStrokeColorWithColor(c, icg);
        CGContextSetLineWidth(c, 1.0);
        CGContextStrokeRect(c, CGRectMake(borderW + 1.5, borderW + 1.5, outW - (borderW + 1.5) * 2, outH - (borderW + 1.5) * 2));
        CGColorRelease(icg);
    }

    CGImageRef out = CGBitmapContextCreateImage(c);
    save_cgimage(out, [gOutRoot stringByAppendingPathComponent:outRel]);
    CGImageRelease(out); CGContextRelease(c);
}

// =========================================================================
// 5. MAP MINI-THUMBS (site_m1..10, 12..16)
// =========================================================================
static void gen_map_thumbs(void) {
    int ids[15] = {1,2,3,4,5,6,7,8,9,10,12,13,14,15,16};
    int facIdx[15] = {2, 10, 6, 3, 0, 5, 11, 7, 8, 9, 1, 4, 6, 7, 11};
    CGImageRef facSheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"facilities-sheet.png"]);
    for (int i=0;i<15;i++) {
        NSString *outRel = [NSString stringWithFormat:@"site_m%d.png", ids[i]];
        if (facSheet) {
            save_framed_ai_cell(facSheet, 4, 3, facIdx[i], 23, 20, 2, rgb(0xb8903c), 1.0, outRel);
        }
    }
    if (facSheet) CGImageRelease(facSheet);
}

// =========================================================================
// 6. CC0 DCSS EQUIPMENT + CODEX AI 12 FACILITIES & 8 WARHORSES
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

    // 12 Chinese Three Kingdoms city facilities from Codex AI sprite sheet (4x3)
    CGImageRef facSheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"facilities-sheet.png"]);
    if (facSheet) {
        for (int i = 0; i < 12; i++) {
            NSString *fn = [NSString stringWithFormat:@"ss_m_%d.png", i + 1];
            RGBA bCol = (i == 7 || i == 9) ? rgb(0xf5cc58) : rgb(0xc99c42);
            save_framed_ai_cell(facSheet, 4, 3, i, 104, 90, 6, bCol, 3.0, fn);
        }
        CGImageRelease(facSheet);
    } else {
        for (int i=1;i<=12;i++) {
            NSString *fn = [NSString stringWithFormat:@"ss_m_%d.png", i];
            composite_cc0_card(fn, 104, 90, rgb(0x283645), rgb(0x111821), rgb(0xc99c42), rgb(0xffe07d), i==8 || i==10, 8, fn);
        }
    }
}

// 8 Legendary Warhorses from Codex AI sprite sheet (4x2), fallback to CC0 horse
static void gen_cc0_mounts(void) {
    CGImageRef mountSheet = load_cgimage([gRawDir stringByAppendingPathComponent:@"mounts-sheet.png"]);
    if (mountSheet) {
        uint32_t mBorder[8] = {0xf5cc58, 0xc99c42, 0xb8c4d4, 0x8ea6cc, 0x61c8ff, 0xffd23f, 0x45e8ff, 0xff9e3d};
        for (int i = 0; i < 8; i++) {
            NSString *fn = [NSString stringWithFormat:@"h_%d.png", i + 1];
            save_framed_ai_cell(mountSheet, 4, 2, i, 207, 203, 12, rgb(mBorder[i]), 5.0, fn);
        }
        CGImageRelease(mountSheet);
        return;
    }
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
            CGContextRef c = create_ctx(128, 128);
            CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
            CGContextDrawImage(c, CGRectMake(0, 0, 128, 128), crop);
            CGImageRef out = CGBitmapContextCreateImage(c);
            save_cgimage(out, [gOutRoot stringByAppendingPathComponent:name]);
            CGImageRelease(out); CGContextRelease(c); CGImageRelease(crop);
        }
        CGImageRelease(sheet);
    }
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        gOutRoot = argc > 1 ? [NSString stringWithUTF8String:argv[1]] : @"apps/web/mapp/assets";
        gRawDir  = argc > 2 ? [NSString stringWithUTF8String:argv[2]] : @"apps/web/mapp/raw-sheets";
        gCc0Dir  = argc > 3 ? [NSString stringWithUTF8String:argv[3]] : @"apps/web/mapp/raw-cc0";
        gIconOut = argc > 4 ? [NSString stringWithUTF8String:argv[4]] : @"apps/web/mapp/icon.png";

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
