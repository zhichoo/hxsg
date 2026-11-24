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
static void pix_pattern(Pix *p, int ox, int oy, const char **rows, int nRows, RGBA pal[128], bool hasPal[128]) {
    for (int ry = 0; ry < nRows; ry++) {
        const char *row = rows[ry];
        for (int rx = 0; row[rx]; rx++) {
            unsigned char ch = (unsigned char)row[rx];
            if (ch < 128 && hasPal[ch]) pix_set(p, ox + rx, oy + ry, pal[ch]);
        }
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
static void save_pix_card(Pix *p, int cw, int ch, RGBA bgTop, RGBA bgBot, RGBA border, RGBA innerBorder, bool hasInner, int pad, NSString *relPath) {
    CGImageRef small = pix_to_cgimage(p);
    CGContextRef ctx = create_ctx(cw, ch);
    draw_gradient(ctx, CGRectMake(0, 0, cw, ch), bgTop, bgTop, bgBot, false);
    CGColorRef bcg = cg_color(border);
    CGContextSetStrokeColorWithColor(ctx, bcg);
    CGContextSetLineWidth(ctx, 4.0);
    CGContextStrokeRect(ctx, CGRectMake(2, 2, cw - 4, ch - 4));
    CGColorRelease(bcg);
    if (hasInner) {
        CGColorRef icg = cg_color(innerBorder);
        CGContextSetStrokeColorWithColor(ctx, icg);
        CGContextSetLineWidth(ctx, 1.5);
        CGContextStrokeRect(ctx, CGRectMake(6, 6, cw - 12, ch - 12));
        CGColorRelease(icg);
    }
    double scale = fmin((double)(cw - pad * 2) / p->w, (double)(ch - pad * 2) / p->h);
    double dw = round(p->w * scale), dh = round(p->h * scale);
    double dx = round((cw - dw) / 2.0), dy = round((ch - dh) / 2.0);
    CGContextSetInterpolationQuality(ctx, kCGInterpolationNone);
    CGContextDrawImage(ctx, CGRectMake(dx, dy, dw, dh), small);
    CGImageRef out = CGBitmapContextCreateImage(ctx);
    save_cgimage(out, [gOutRoot stringByAppendingPathComponent:relPath]);
    CGImageRelease(out);
    CGContextRelease(ctx);
    CGImageRelease(small);
}

// =========================================================================
// 1. 3-PART CHARACTER SPRITES (_h / _b / _f)
// =========================================================================
typedef struct {
    const char *key;
    int cls;
    bool female, enemy;
    uint32_t primary, secondary, trim, hair, skin, weapon;
} SpriteSpec;

static void gen_sprites(void) {
    SpriteSpec specs[] = {
        {"r1",  1, false, false, 0x2a5cb8, 0x1b376e, 0xf2c64b, 0x1e1818, 0xf4c79c, 0xdce6f2},
        {"r1n", 1, true,  false, 0xc92c2c, 0x7a1616, 0xf8d465, 0x261717, 0xfad2ad, 0xe6effa},
        {"r2",  2, false, false, 0x2c789e, 0x1a4861, 0xf0d67a, 0x201d1d, 0xf4c99e, 0xf5f2e6},
        {"r2n", 2, true,  false, 0x2b8c63, 0x185239, 0xffe07d, 0x221818, 0xfcd5b1, 0xfff6d6},
        {"r3",  3, false, false, 0x7034a8, 0x421c66, 0xffe169, 0x282633, 0xf2c69c, 0x7cf0ff},
        {"r3n", 3, true,  false, 0xa3328f, 0x5c1950, 0xffe278, 0x241729, 0xfad3b0, 0x8ef5ff},
        {"n1",  1, false, true,  0x7c4a26, 0x4a2a14, 0xd99b38, 0x261d17, 0xe8b588, 0xbac4cf},
        {"n2",  2, false, true,  0x585e30, 0x34381b, 0xd9b343, 0x1c1b18, 0xe6b488, 0xd9cfa9},
        {"n2n", 2, true,  true,  0x8a3a4a, 0x4f1e28, 0xe8bd54, 0x24181a, 0xf0be96, 0xf2e4c4},
        {"n3",  3, false, true,  0xb8861e, 0x6e4d0c, 0xffe875, 0x241d15, 0xe8b68a, 0x9bff75},
        {"n3n", 3, true,  true,  0x7d2948, 0x471527, 0xf2c95c, 0x261520, 0xf2c39d, 0xc27dff},
    };
    const char *headWMale[] = {
        ".......OOOOO.........","......OOTTTTO........",".....OOPPPPPPO.......","....OPPPTTPPPPO......",
        "...OOTTTTTTTTTTO.....","..OOHHSSSSSSHHHO.....","..OOHSSSSSSSSHOO.....","..OOSSEWSSSEWSO......",
        "..OOSSEESSSEESO......","..OOSSSSSSSSSSO......","...OOSSSSSSSOO.......","....OOTTTTTTO........",".....OOOOOOO........."
    };
    const char *headWEnemy[] = {
        "......OOOOOOO........",".....OODDDDDDO.......","....ODDDTTTDDDO......","...ODDDDDDDDDDDO.....",
        "..OOTTTTTTTTTTTO.....","..OOHHSSSSSSHHHO.....","..OOHSSSSSSSSHOO.....","..OOSSEWSSSEWSO......",
        "..OOSSEESSSEESO......","..OOSSSSSSSSSSO......","...OSSSSSSSSSO.......","...OOHHHHHHHHO.......","....OODDDDDDO........",".....OOOOOOO........."
    };
    const char *headWFemale[] = {
        ".......OOOOO.........",".....OOHHHHHOO.......","....OHHTTTTTHHO......","...OHHPHHHHPHHHO.....",
        "..OOHHHHHHHHHHHHO....","..OHHHSSSSSSHHHHO....","..OHHSSSSSSSSHHHO....","..OHSEWSSSEWSSHHO....",
        "..OHSEESSSSEESHHO....","..OHBSSSSSSSBSHHO....","..OHHSSSSSSSSHHHO....","...OHHSSSSSSHHHO.....",
        "...OOHHHHHHHHHO......","....OOTTTTTTOO.......",".....OOOOOOOO........"
    };
    const char *headSMale[] = {
        "......OOOOOOO........",".....OOPPPPPPO.......",".....OPTTTTTPO.......","....OOPPPPPPPPO......",
        "...OOHHHHHHHHHO......","..OOHHSSSSSSHHHO.....","..OOHSSSSSSSSHOO.....","..OOSSEWSSSEWSO......",
        "..OOSSEESSSEESO......","..OOSSSSSSSSSSO......","...OOSSSSSSSOO.......","....OOHHHHHHO........",".....OOOOOOO........."
    };
    const char *headSFemale[] = {
        "......OOOTOOO........",".....OOHHHHHOO.......","....OHHTTTTTHHO......","...OHHHHHHHHHHHO.....",
        "..OOHHSSSSSSHHHO.....","..OHHSSSSSSSSHHHO....","..OHSEWSSSEWSSHHO....","..OHSEESSSSEESHHO....",
        "..OHBSSSSSSSBSHHO....","..OHHSSSSSSSSHHHO....","...OHHSSSSSSHHHO.....","...OOHHPPPPHHHO......",
        "....OOOTTTTOOO.......",".....OOOOOOOO........"
    };
    const char *headMystic[] = {
        ".......OOTOO.........","......OOTTTTO........",".....OOPPPPPPO.......","....OPTTTTTTTPO......",
        "...OOHHHHHHHHHO......","..OOHHSSSSSSHHHO.....","..OOHSSSSSSSSHOO.....","..OOSSEWSSSEWSO......",
        "..OOSSEESSSEESO......","..OOSSSSSSSSSSO......","...OOSSSSSSSOO.......","....OOTTTTTTO........",".....OOOOOOO........."
    };

    RGBA O = rgb(0x140d0a), W = rgb(0xffffff), E = rgb(0x120e12), B = rgba_hex(0xe88a82, 160);
    RGBA bootD = rgb(0x261c16), bootM = rgb(0x4a3728), hdl = rgb(0x70421c);

    int count = (int)(sizeof(specs) / sizeof(specs[0]));
    for (int i = 0; i < count; i++) {
        SpriteSpec s = specs[i];
        RGBA pal[128] = {0}; bool hp[128] = {0};
        pal['O'] = O; hp['O'] = true; pal['H'] = rgb(s.hair); hp['H'] = true;
        pal['S'] = rgb(s.skin); hp['S'] = true; pal['E'] = E; hp['E'] = true;
        pal['W'] = W; hp['W'] = true; pal['T'] = rgb(s.trim); hp['T'] = true;
        pal['P'] = rgb(s.primary); hp['P'] = true; pal['D'] = rgb(s.secondary); hp['D'] = true;
        pal['B'] = B; hp['B'] = true;

        Pix head = pix_new(21, 21);
        const char **rows; int nr;
        if (s.cls == 1) {
            if (s.female) { rows = headWFemale; nr = 15; }
            else if (s.enemy) { rows = headWEnemy; nr = 14; }
            else { rows = headWMale; nr = 13; }
        } else if (s.cls == 2) {
            if (s.female) { rows = headSFemale; nr = 14; }
            else { rows = headSMale; nr = 13; }
        } else {
            rows = headMystic; nr = 13;
        }
        pix_pattern(&head, 0, 20 - nr, rows, nr, pal, hp);
        pix_save(&head, [NSString stringWithFormat:@"%s_h.png", s.key]);
        pix_free(&head);

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
}

// =========================================================================
// 2. 8 BATTLEFIELD BIOMES (_3/_4/_5/_6)
// =========================================================================
typedef struct {
    const char *prefix;
    uint32_t skyTop, skyBot, hillFar, hillNear, accent, groundTop, groundBot;
    bool hasWall, hasFire;
} BiomeSpec;

static void gen_biomes(void) {
    BiomeSpec biomes[] = {
        {"f_bg2",  0x3b6ea5, 0x87b8d8, 0x457042, 0x2f592c, 0x6e5c47, 0x5c7536, 0x3d4f22, true,  false},
        {"f_bg4",  0x4b74a8, 0xb5d3eb, 0x547c4f, 0x3a6337, 0xf29cb8, 0x69823e, 0x455929, false, false},
        {"f_bg5",  0x597a96, 0xd1c497, 0x7d7042, 0x5c4f28, 0xb88939, 0x8a7941, 0x5c4f26, true,  false},
        {"f_bg6",  0x2c4b75, 0x829bb8, 0x4d5966, 0x3a424d, 0xa6322b, 0x69655c, 0x47433c, true,  false},
        {"f_bg7",  0x423a52, 0xa87c65, 0x5e4a3d, 0x403128, 0xc93a2b, 0x6b563c, 0x453522, true,  false},
        {"f_bg8",  0x594d3b, 0xc9a977, 0x8a6d43, 0x664e2c, 0xd4b67b, 0x8f7443, 0x5e4b28, false, false},
        {"f_bg9",  0x26294a, 0x7d5d73, 0x403d52, 0x2d2b3b, 0xd99e43, 0x524c38, 0x332f22, false, false},
        {"f_bg20", 0x4a1313, 0xd65b2b, 0x5c221a, 0x3b130e, 0xffb338, 0x6b321d, 0x3d190e, false, true},
    };
    int n = (int)(sizeof(biomes) / sizeof(biomes[0]));
    for (int i = 0; i < n; i++) {
        BiomeSpec b = biomes[i];
        RGBA st = rgb(b.skyTop), sb = rgb(b.skyBot), hf = rgb(b.hillFar), hn = rgb(b.hillNear), ac = rgb(b.accent);
        RGBA gt = rgb(b.groundTop), gb = rgb(b.groundBot);
        Pix top = pix_new(240, 35);
        for (int y = 0; y < 35; y++) {
            double t = y / 34.0;
            RGBA sky = { (uint8_t)(st.r*(1-t)+sb.r*t), (uint8_t)(st.g*(1-t)+sb.g*t), (uint8_t)(st.b*(1-t)+sb.b*t), 255 };
            for (int x = 0; x < 240; x++) pix_set(&top, x, y, sky);
        }
        for (int x = 0; x < 240; x++) {
            int h1 = 15 + (int)(sin(x * 0.045) * 6 + cos(x * 0.11) * 3);
            for (int y = h1; y < 35; y++) pix_set(&top, x, y, hf);
            int h2 = 23 + (int)(cos(x * 0.065 + 1.2) * 4 + sin(x * 0.17) * 2);
            for (int y = h2; y < 35; y++) pix_set(&top, x, y, hn);
        }
        if (b.hasWall) {
            pix_rect(&top, 25, 22, 190, 13, rgb(0x595752));
            for (int x = 25; x < 215; x += 8) pix_rect(&top, x, 19, 5, 3, rgb(0x6e6c66));
            pix_rect(&top, 104, 14, 32, 8, ac);
            pix_rect(&top, 100, 12, 40, 3, rgb(0x2b2421));
            pix_rect(&top, 108, 9, 24, 3, rgb(0x3d332f));
        } else {
            for (int x = 10; x < 230; x += 16) {
                int ty = 18 + (x % 7);
                pix_circle(&top, x, ty, 5, b.hasFire ? ac : hn);
                pix_circle(&top, x + 2, ty - 2, 3, ac);
            }
        }
        Pix l5 = pix_new(120, 35), r6 = pix_new(120, 35);
        for (int y = 0; y < 35; y++) {
            memcpy(l5.buf + y * 120 * 4, top.buf + y * 240 * 4, 120 * 4);
            memcpy(r6.buf + y * 120 * 4, top.buf + (y * 240 + 120) * 4, 120 * 4);
        }
        pix_save(&l5, [NSString stringWithFormat:@"%s_5.png", b.prefix]);
        pix_save(&r6, [NSString stringWithFormat:@"%s_6.png", b.prefix]);
        pix_free(&top); pix_free(&l5); pix_free(&r6);

        Pix bot = pix_new(240, 15);
        for (int y = 0; y < 15; y++) {
            double t = y / 14.0;
            RGBA g = { (uint8_t)(gt.r*(1-t)+gb.r*t), (uint8_t)(gt.g*(1-t)+gb.g*t), (uint8_t)(gt.b*(1-t)+gb.b*t), 255 };
            for (int x = 0; x < 240; x++) pix_set(&bot, x, y, g);
        }
        for (int x = 6; x < 236; x += 13) {
            pix_rect(&bot, x, 2 + (x % 5), 4, 2, ac);
            pix_rect(&bot, x + 3, 8 + (x % 4), 5, 2, hn);
        }
        Pix l3 = pix_new(120, 15), r4 = pix_new(120, 15);
        for (int y = 0; y < 15; y++) {
            memcpy(l3.buf + y * 120 * 4, bot.buf + y * 240 * 4, 120 * 4);
            memcpy(r4.buf + y * 120 * 4, bot.buf + (y * 240 + 120) * 4, 120 * 4);
        }
        pix_save(&l3, [NSString stringWithFormat:@"%s_3.png", b.prefix]);
        pix_save(&r4, [NSString stringWithFormat:@"%s_4.png", b.prefix]);
        pix_free(&bot); pix_free(&l3); pix_free(&r4);
    }
}

// =========================================================================
// 3. BATTLE VFX, NUMBERS & STATUS GLYPHS
// =========================================================================
static void gen_vfx(void) {
    // f_sd.png (96x71)
    Pix sd = pix_new(96, 71);
    int b0[6][2] = {{18,2},{12,20},{22,26},{14,46},{24,52},{16,68}};
    int b1[6][2] = {{52,0},{59,18},{47,28},{57,44},{48,56},{53,70}};
    int b2[5][2] = {{83,3},{77,22},{87,32},{78,50},{84,67}};
    for (int i=0;i<5;i++) {
        pix_line(&sd,b0[i][0],b0[i][1],b0[i+1][0],b0[i+1][1],rgba_hex(0x38b6ff,180),5);
        pix_line(&sd,b0[i][0],b0[i][1],b0[i+1][0],b0[i+1][1],rgb(0xb8f2ff),3);
        pix_line(&sd,b0[i][0],b0[i][1],b0[i+1][0],b0[i+1][1],rgb(0xffffff),1);
        pix_line(&sd,b1[i][0],b1[i][1],b1[i+1][0],b1[i+1][1],rgba_hex(0x38b6ff,180),5);
        pix_line(&sd,b1[i][0],b1[i][1],b1[i+1][0],b1[i+1][1],rgb(0xb8f2ff),3);
        pix_line(&sd,b1[i][0],b1[i][1],b1[i+1][0],b1[i+1][1],rgb(0xffffff),1);
    }
    for (int i=0;i<4;i++) {
        pix_line(&sd,b2[i][0],b2[i][1],b2[i+1][0],b2[i+1][1],rgba_hex(0x38b6ff,180),5);
        pix_line(&sd,b2[i][0],b2[i][1],b2[i+1][0],b2[i+1][1],rgb(0xb8f2ff),3);
        pix_line(&sd,b2[i][0],b2[i][1],b2[i+1][0],b2[i+1][1],rgb(0xffffff),1);
    }
    pix_save(&sd, @"f_sd.png"); pix_free(&sd);

    // fire.png (66x44)
    Pix fi = pix_new(66, 44);
    int fc[3][3] = {{12,24,9},{35,22,8},{55,23,8}};
    for (int i=0;i<3;i++) {
        pix_circle(&fi, fc[i][0], fc[i][1]+5, fc[i][2], rgba_hex(0xe63917,230));
        pix_circle(&fi, fc[i][0], fc[i][1]-3, fc[i][2]-2, rgba_hex(0xff7b1c,240));
        pix_circle(&fi, fc[i][0], fc[i][1]-9, fc[i][2]-4, rgb(0xffd23f));
        pix_circle(&fi, fc[i][0], fc[i][1]+2, fc[i][2]-4, rgb(0xfff5a8));
    }
    pix_save(&fi, @"fire.png"); pix_free(&fi);

    // fg.png (92x68) starburst in x=27..92
    Pix fg = pix_new(92, 68);
    for (int a=0;a<360;a+=30) {
        double rad = a * M_PI / 180.0;
        double len = (a % 60 == 0) ? 26.0 : 17.0;
        pix_line(&fg, 59, 34, 59+(int)(cos(rad)*len), 34+(int)(sin(rad)*len), rgba_hex(0x52d1ff,220), 3);
        pix_line(&fg, 59, 34, 59+(int)(cos(rad)*len*0.7), 34+(int)(sin(rad)*len*0.7), rgb(0xffffff), 1);
    }
    pix_circle(&fg, 59, 34, 7, rgb(0xffffff));
    pix_save(&fg, @"fg.png"); pix_free(&fg);

    // fg2.png (104x28)
    Pix fg2 = pix_new(104, 28);
    int g2[4][2] = {{0,24},{26,28},{54,22},{78,25}};
    for (int i=0;i<4;i++) {
        int cx = g2[i][0] + g2[i][1]/2, r = 5 + (i % 3) * 2;
        pix_rect(&fg2, cx-r, 2, r*2, 24, rgba_hex(0xffc837,170));
        pix_rect(&fg2, cx-r/2, 0, r, 28, rgba_hex(0xfff6b8,230));
        pix_circle(&fg2, cx, 14, r, rgba_hex(0xffffff,200));
    }
    pix_save(&fg2, @"fg2.png"); pix_free(&fg2);

    // fg3.png (166x33)
    Pix fg3 = pix_new(166, 33);
    int g3[5][2] = {{0,39},{40,37},{78,34},{114,24},{139,27}};
    for (int i=0;i<5;i++) {
        int cx = g3[i][0] + g3[i][1]/2, r = g3[i][1]/2 - 2; if (r > 13) r = 13;
        pix_circle(&fg3, cx, 16, r, rgba_hex(0x8b2fc9,175));
        pix_circle(&fg3, cx, 16, r>4?r-4:3, rgba_hex(0xe38aff,220));
        pix_circle(&fg3, cx+(i-2)*2, 16, 3, rgba_hex(0xffffff,220));
    }
    pix_save(&fg3, @"fg3.png"); pix_free(&fg3);

    // pi_fl.png (86x35)
    Pix pf = pix_new(86, 35);
    int p3[3][2] = {{0,30},{30,32},{62,24}};
    for (int i=0;i<3;i++) {
        int cx = p3[i][0] + p3[i][1]/2;
        pix_circle(&pf, cx, 17, 10, rgba_hex(0x2ca9e8,190));
        pix_circle(&pf, cx, 15, 6, rgba_hex(0xc2f6ff,240));
    }
    pix_save(&pf, @"pi_fl.png"); pix_free(&pf);

    // dead_fl.png (111x43)
    Pix df = pix_new(111, 43);
    int d4[4][2] = {{0,31},{31,30},{61,32},{93,18}};
    for (int i=0;i<4;i++) {
        int cx = d4[i][0] + d4[i][1]/2;
        pix_circle(&df, cx, 26, i==3?7:9, rgba_hex(0x45e8a6,185));
        pix_circle(&df, cx, 17, i==3?5:6, rgba_hex(0xa6ffde,220));
        pix_circle(&df, cx, 10, 3, rgba_hex(0xffffff,230));
    }
    pix_save(&df, @"dead_fl.png"); pix_free(&df);

    // blood.png (38x22) & smoke.png (60x12) & dead_1.png (31x16)
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

    // f_stat.png (118x19)
    NSArray *stLbls = @[@"封",@"围",@"攻",@"乱",@"毒",@"速",@"隐",@"固"];
    int stX[8] = {0,15,30,45,60,75,89,103};
    int stW[8] = {15,15,15,15,15,14,14,15};
    uint32_t stC[8] = {0x136ea8,0x8f5b0d,0xb82a14,0x9e198b,0x1e7a2c,0x107a8f,0x4b4c6b,0x6b4c1c};
    CGContextRef stCtx = create_ctx(118, 19);
    for (int i=0;i<8;i++) {
        CGColorRef bg = cg_color(rgb(stC[i])); CGColorRef bd = cg_color(rgb(0xffe27a));
        CGContextSetFillColorWithColor(stCtx, bg);
        CGContextFillRect(stCtx, CGRectMake(stX[i]+1, 1, stW[i]-2, 17));
        CGContextSetStrokeColorWithColor(stCtx, bd); CGContextSetLineWidth(stCtx, 1);
        CGContextStrokeRect(stCtx, CGRectMake(stX[i]+1.5, 1.5, stW[i]-3, 16));
        CGColorRelease(bg); CGColorRelease(bd);
        draw_outlined_text(stCtx, stLbls[i], stX[i] + stW[i]/2.0, 9.5, @"STHeitiSC-Medium", 11, rgb(0xffffff), rgb(0x000000), 1.2);
    }
    CGImageRef stImg = CGBitmapContextCreateImage(stCtx);
    save_cgimage(stImg, [gOutRoot stringByAppendingPathComponent:@"f_stat.png"]);
    CGImageRelease(stImg); CGContextRelease(stCtx);

    // num.png & num2.png (446x50)
    NSArray *digits = @[@"0",@"1",@"2",@"3",@"4",@"5",@"6",@"7",@"8",@"9",@"-"];
    int dx1[11] = {0,50,86,126,162,198,243,284,324,365,405};
    int dw1[11] = {36,22,36,36,36,36,36,36,36,36,41};
    int dx2[11] = {0,50,86,126,162,203,243,279,324,365,405};
    CGContextRef n1 = create_ctx(446, 50);
    CGContextRef n2 = create_ctx(446, 50);
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
// 4. RETRO CHINESE UI BANNERS & BUTTONS
// =========================================================================
static void gen_ui(void) {
    // tit_bg.png
    CGContextRef c = create_ctx(540, 90);
    draw_gradient(c, CGRectMake(0,0,540,90), rgb(0x50666b), rgb(0x2d3c40), rgb(0x1a2426), true);
    CGColorRef g = cg_color(rgba_hex(0xc9a34b, 190)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 3);
    CGContextStrokeRect(c, CGRectMake(2,4,536,82)); CGColorRelease(g);
    CGColorRef w18 = cg_color(rgba_hex(0xffffff, 18)); CGContextSetFillColorWithColor(c, w18);
    for (int x=18;x<520;x+=48) CGContextFillEllipseInRect(c, CGRectMake(x,22,32,46));
    CGColorRelease(w18);
    CGImageRef im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"tit_bg.png"]);
    CGImageRelease(im); CGContextRelease(c);

    // fig_tit.png
    c = create_ctx(540, 90);
    draw_gradient(c, CGRectMake(0,0,540,90), rgb(0x6b1814), rgb(0x450d0a), rgb(0x210504), true);
    g = cg_color(rgb(0xe6b84c)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 3);
    CGContextStrokeRect(c, CGRectMake(2,3,536,84)); CGColorRelease(g);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"fig_tit.png"]);
    CGImageRelease(im); CGContextRelease(c);

    // sc_bg_1.png (482x333)
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

    // sc_fjbg.png (441x117)
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

    // gnk_1..4 & gnk_s1..4
    NSArray *tabs = @[@"人物",@"设施",@"移动",@"功能"];
    for (int i=0;i<4;i++) {
        c = create_ctx(270, 135);
        draw_gradient(c, CGRectMake(0,0,270,135), rgb(0x594225), rgb(0x3b2814), rgb(0x211509), true);
        g = cg_color(rgb(0xa6833c)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 5);
        CGContextStrokeRect(c, CGRectMake(4,4,262,127)); CGColorRelease(g);
        draw_outlined_text(c, tabs[i], 135, 68, @"STHeitiSC-Medium", 54, rgb(0xf2e3be), rgb(0x1c0d03), 4.0);
        im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"gnk_%d.png", i+1]]);
        CGImageRelease(im); CGContextRelease(c);

        c = create_ctx(270, 135);
        draw_gradient(c, CGRectMake(0,0,270,135), rgb(0xd94326), rgb(0x9c1c11), rgb(0x5c0c07), true);
        g = cg_color(rgb(0xffe478)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 6);
        CGContextStrokeRect(c, CGRectMake(4,4,262,127)); CGColorRelease(g);
        draw_outlined_text(c, tabs[i], 135, 68, @"STHeitiSC-Medium", 56, rgb(0xfff59e), rgb(0x380800), 4.5);
        im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:[NSString stringWithFormat:@"gnk_s%d.png", i+1]]);
        CGImageRelease(im); CGContextRelease(c);
    }

    // chat_bgb, chat_bq, chat_fy
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
    draw_gradient(c, CGRectMake(0,0,99,131), rgb(0xe8b843), rgb(0xbd7c15), rgb(0x7d4608), true);
    g = cg_color(rgb(0x451803)); CGContextSetStrokeColorWithColor(c, g); CGContextSetLineWidth(c, 5);
    CGContextStrokeRect(c, CGRectMake(3,3,93,125)); CGColorRelease(g);
    draw_outlined_text(c, @"发", 49.5, 92, @"STHeitiSC-Medium", 40, rgb(0xfff8cf), rgb(0x3b1200), 3.5);
    draw_outlined_text(c, @"言", 49.5, 40, @"STHeitiSC-Medium", 40, rgb(0xfff8cf), rgb(0x3b1200), 3.5);
    im = CGBitmapContextCreateImage(c); save_cgimage(im, [gOutRoot stringByAppendingPathComponent:@"chat_fy.png"]);
    CGImageRelease(im); CGContextRelease(c);

    // f_sl.png & f_bb.png
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
    uint32_t roofs[15] = {0xc93a2b,0x3f7d3a,0xd4a12a,0x5b8c42,0x7d653b,0x3d6d94,0x8c3926,0x6b4f7a,0xd45b22,0x2e7d6c,0x7d6d3b,0x66503b,0x855c32,0xc94122,0x4d5478};
    for (int i=0;i<15;i++) {
        Pix c = pix_new(23, 20);
        pix_rect(&c, 0, 0, 23, 20, rgb(0x1c2529));
        pix_stroke(&c, 0, 0, 23, 20, rgb(0xa68238));
        pix_rect(&c, 4, 11, 15, 7, rgb(0xc9bfa8));
        pix_rect(&c, 9, 13, 5, 5, rgb(0x241d1a));
        pix_rect(&c, 2, 8, 19, 3, rgb(roofs[i]));
        pix_rect(&c, 5, 5, 13, 3, rgb(roofs[i]));
        pix_rect(&c, 9, 3, 5, 2, rgb(0xffe066));
        pix_save(&c, [NSString stringWithFormat:@"site_m%d.png", ids[i]]);
        pix_free(&c);
    }
}

// =========================================================================
// 6. HAND-CRAFTED 16-BIT PIXEL ART: MOUNTS, EQUIPMENT, FACILITIES
// =========================================================================
static void gen_mounts(void) {
    typedef struct { const char *f; uint32_t coat, shade, mane, saddle, trim, aura; bool hasAura; } HS;
    HS hs[8] = {
        {"h_1.png", 0xc9281c, 0x7d120b, 0xffb830, 0xe6a825, 0xfff099, 0xff6b24, true},
        {"h_2.png", 0xd9a843, 0x996d1f, 0x5c3a14, 0x8c3523, 0xf2d16b, 0, false},
        {"h_3.png", 0x2a2d36, 0x14161c, 0x4b5263, 0x7a1c1c, 0xd0d9e6, 0, false},
        {"h_4.png", 0x593424, 0x331b11, 0x1a1312, 0x334766, 0xc9b468, 0x7a8ca8, true},
        {"h_5.png", 0xe8edf2, 0xaab6c4, 0xffffff, 0x2665a8, 0x7ef0ff, 0x61c8ff, true},
        {"h_6.png", 0xf2c549, 0xb88416, 0xfff5ad, 0xa8201a, 0xffe875, 0xffde59, true},
        {"h_7.png", 0xd9f2f7, 0x7cb5c7, 0x70f3ff, 0x26598f, 0xfff499, 0x45e8ff, true},
        {"h_8.png", 0x9e1c24, 0x590b10, 0xffe066, 0xd49617, 0xffffff, 0xff9e3d, true},
    };
    const char *rows[26] = {
        "................................","................................",".......OO.......................",
        "......OMMO......................",".....OCCMMO.....................","....OCCCCMMO....................",
        "...OECWCCCMMO...................","..OCCCCCCCMMMO..................","..OOCCCCSSMMMO..........OOO.....",
        "....OOCCSSMMMO.........OMMMO....","......OCSSMMO.OOOOOOO..OMMMMO...","......OCCCCMOOSTTTTTSOOOMMMMO...",
        ".....OCCCCCCOSTTTTTTTSOOMMMO....",".....OCCCCCCCSSSSSSSSCCOMMO.....",".....OCCCSSCCCCCCCCSSCCCMO......",
        ".....OCCSSCCCCCCCCCCSSCCCO......","......OCSSCCCCCCCCCCSSCCO.......","......OOCSSCCCCCCCCSSCCOO.......",
        ".......OOCSOOOOOOOOSCCOO........",".......OCCO........OCCO.........","......OCCO..........OCCO........",
        "......OSSO..........OSSO........",".....OCCO............OCCO.......",".....OHHO............OHHO.......",
        ".....OOOO............OOOO.......","................................",
    };
    for (int i=0;i<8;i++) {
        Pix c = pix_new(32, 26);
        if (hs[i].hasAura) {
            pix_circle(&c, 16, 13, 12, rgba_hex(hs[i].aura, 55));
            pix_circle(&c, 16, 13, 9, rgba_hex(hs[i].aura, 90));
        }
        RGBA pal[128] = {0}; bool hp[128] = {0};
        pal['O']=rgb(0x140a08); hp['O']=true; pal['C']=rgb(hs[i].coat); hp['C']=true;
        pal['S']=rgb(hs[i].shade); hp['S']=true; pal['M']=rgb(hs[i].mane); hp['M']=true;
        pal['T']=rgb(hs[i].trim); hp['T']=true; pal['E']=rgb(0x110c0c); hp['E']=true;
        pal['W']=rgb(0xffffff); hp['W']=true; pal['H']=rgb(0x241c18); hp['H']=true;
        pix_pattern(&c, 0, 0, rows, 26, pal, hp);
        pix_rect(&c, 14, 11, 7, 3, rgb(hs[i].saddle));
        pix_rect(&c, 15, 11, 5, 1, rgb(hs[i].trim));
        save_pix_card(&c, 207, 203, rgb(0x4a1914), rgb(0x1c0807), rgb(hs[i].hasAura ? 0xf5cc58 : 0xb08434), rgb(0x6b3a24), true, 14, [NSString stringWithUTF8String:hs[i].f]);
        pix_free(&c);
    }
}

static void gen_equipment(void) {
    RGBA O=rgb(0x140c0a), W=rgb(0xffffff), wood=rgb(0x7d4c24), woodD=rgb(0x4d2c12);
    RGBA bronze=rgb(0xc98a3b), steel=rgb(0xb8c7d9), steelD=rgb(0x6d7c8f);
    RGBA gold=rgb(0xffd247), goldD=rgb(0xb87d14), red=rgb(0xd92b24), blue=rgb(0x2e7dd9);
    RGBA cyan=rgb(0x7ef2ff), purple=rgb(0x8a32b8), jade=rgb(0x38b878), cloth=rgb(0xa88b59), navy=rgb(0x243b6b);
    uint32_t borders[15] = {0x9c8b68,0x9c8b68,0x5ca8e6,0xc26ef0,0xffc83d, 0x9c8b68,0x5ca8e6,0xc26ef0, 0x9c8b68,0x5ca8e6,0xc26ef0,0xffc83d, 0x9c8b68,0x5ca8e6,0xffc83d};

    for (int i=1;i<=15;i++) {
        Pix c = pix_new(26, 24);
        switch (i) {
            case 1: pix_line(&c,4,21,18,7,wood,2); pix_line(&c,17,8,22,3,bronze,3); pix_line(&c,19,6,23,2,gold,1); pix_rect(&c,14,7,3,5,red); break;
            case 2: pix_line(&c,5,20,9,16,woodD,2); pix_line(&c,7,14,12,19,gold,2); pix_line(&c,10,15,21,4,bronze,3); pix_line(&c,11,14,21,4,rgb(0xf5c878),1); pix_rect(&c,5,19,3,4,gold); break;
            case 3: pix_line(&c,4,20,8,16,wood,2); pix_circle(&c,4,20,2,gold); pix_line(&c,7,14,11,18,gold,2); pix_line(&c,9,15,19,5,steelD,4); pix_line(&c,10,14,21,4,steel,3); pix_line(&c,12,12,21,4,W,1); break;
            case 4: pix_line(&c,4,21,8,17,goldD,2); pix_line(&c,6,15,11,20,gold,2); pix_line(&c,9,16,22,3,jade,3); pix_line(&c,10,15,22,3,cyan,1); for(int k=0;k<4;k++) pix_set(&c,11+k*3,14-k*3,gold); break;
            case 5: pix_circle(&c,18,7,7,rgba_hex(0x52d1ff,75)); pix_line(&c,3,22,17,8,steelD,2); pix_line(&c,16,9,23,2,steel,4); pix_line(&c,18,7,23,2,W,2); pix_rect(&c,13,8,4,5,blue); pix_rect(&c,14,9,2,3,cyan); break;
            case 6: pix_rect(&c,5,9,16,7,O); pix_rect(&c,6,10,14,5,jade); pix_rect(&c,6,10,14,2,rgb(0x6be0a6)); pix_rect(&c,19,12,4,7,jade); pix_rect(&c,11,11,4,3,gold); break;
            case 7: pix_rect(&c,11,2,4,5,red); pix_rect(&c,6,7,14,12,O); pix_rect(&c,7,8,12,10,steelD); pix_rect(&c,8,8,10,5,steel); pix_rect(&c,7,13,12,2,gold); pix_rect(&c,10,15,6,4,O); break;
            case 8: pix_line(&c,10,10,4,2,red,2); pix_line(&c,16,10,22,2,red,2); pix_rect(&c,7,10,12,10,O); pix_rect(&c,8,11,10,8,purple); pix_rect(&c,8,11,10,2,gold); pix_rect(&c,8,17,10,2,gold); pix_rect(&c,11,13,4,4,gold); break;
            case 9: pix_rect(&c,4,6,18,14,O); pix_rect(&c,5,7,16,12,cloth); pix_rect(&c,9,7,8,12,rgb(0x856b3f)); pix_rect(&c,5,14,16,2,woodD); pix_rect(&c,10,6,6,3,O); break;
            case 10: pix_rect(&c,4,5,18,15,O); pix_rect(&c,5,6,16,13,steelD); pix_rect(&c,6,6,14,6,steel); for(int y=8;y<18;y+=3) for(int x=6;x<20;x+=3) pix_set(&c,x,y,W); pix_rect(&c,5,14,16,2,gold); pix_rect(&c,10,5,6,3,O); break;
            case 11: pix_rect(&c,4,5,18,16,O); pix_rect(&c,5,6,16,14,navy); pix_rect(&c,5,6,16,2,gold); pix_circle(&c,13,13,4,gold); pix_circle(&c,13,13,2,W); pix_rect(&c,13,13,2,2,O); pix_rect(&c,5,18,16,2,gold); break;
            case 12: pix_circle(&c,13,13,10,rgba_hex(0xffd247,75)); pix_rect(&c,4,5,18,16,O); pix_rect(&c,5,6,16,14,goldD); pix_rect(&c,6,6,14,8,gold); pix_rect(&c,10,9,6,5,red); pix_rect(&c,11,10,4,3,W); pix_rect(&c,5,16,16,2,red); break;
            case 13: pix_rect(&c,5,12,16,7,O); pix_rect(&c,6,13,14,5,cloth); pix_rect(&c,6,16,14,2,wood); pix_line(&c,8,11,13,16,woodD,1); pix_line(&c,13,11,18,16,woodD,1); break;
            case 14: pix_rect(&c,6,5,9,14,O); pix_rect(&c,6,14,15,6,O); pix_rect(&c,7,6,7,12,blue); pix_rect(&c,7,15,13,4,blue); pix_rect(&c,7,6,7,2,cyan); pix_rect(&c,14,15,6,2,W); break;
            case 15: pix_circle(&c,13,13,10,rgba_hex(0x7ef2ff,70)); pix_rect(&c,7,5,9,14,O); pix_rect(&c,7,14,14,6,O); pix_rect(&c,8,6,7,12,goldD); pix_rect(&c,8,15,12,4,gold); pix_line(&c,7,10,2,6,W,2); pix_line(&c,7,13,3,10,cyan,2); break;
        }
        save_pix_card(&c, 207, 167, rgb(0x3b1240), rgb(0x1a061f), rgb(borders[i-1]), rgb(0x5e2c66), true, 14, [NSString stringWithFormat:@"sg4b_item%d.png", i]);
        pix_free(&c);
    }
}

static void gen_facilities(void) {
    typedef struct { uint32_t roof, wall, accent; int mode; } FS;
    // mode: 0=std, 1=tower, 2=arena, 3=bank, 4=lantern, 5=forge, 6=peach, 7=banners
    FS fs[12] = {
        {0xb83227,0xd9bfa0,0xff6b2b,4},{0x2b8559,0xe3d8c1,0xf2c94c,0},{0x9c1e1e,0xc9b497,0xffe066,7},{0xc94f7c,0xe6ccb8,0xffa6c9,6},
        {0x3a6ea5,0xd9cbb8,0xffe066,7},{0x5c4738,0x8c8279,0xff7b24,5},{0x455266,0xa6a095,0xd93829,7},{0xc98a1e,0x5c241c,0xfff08a,1},
        {0x8f1d45,0xd4b28a,0xffe875,4},{0x2e6b5e,0xd9c6a3,0xffd23f,3},{0xd93b26,0xe6d2b5,0xffe875,0},{0x7a5c38,0xb8ad9c,0xd92b24,2},
    };
    RGBA dark=rgb(0x1a110e), wood=rgb(0x6b3e1d), glow=rgb(0xffe478);
    for (int i=0;i<12;i++) {
        Pix c = pix_new(28, 24);
        RGBA rf=rgb(fs[i].roof), wl=rgb(fs[i].wall), ac=rgb(fs[i].accent);
        if (fs[i].mode == 1) {
            for (int t=0;t<4;t++) {
                int y=18-t*4, w=20-t*3, x=(28-w)/2;
                pix_rect(&c, x+2, y+1, w-4, 3, wl); pix_rect(&c, x, y, w, 2, rf); pix_set(&c, 14, y+2, ac);
            }
            pix_rect(&c, 13, 1, 2, 4, ac);
        } else if (fs[i].mode == 2) {
            pix_rect(&c, 3, 15, 22, 7, wl); pix_stroke(&c, 3, 15, 22, 7, dark);
            pix_rect(&c, 5, 11, 18, 4, rf); pix_circle(&c, 14, 11, 3, ac);
            pix_line(&c, 4, 14, 4, 4, wood, 1); pix_rect(&c, 5, 4, 4, 3, ac);
            pix_line(&c, 23, 14, 23, 4, wood, 1); pix_rect(&c, 19, 4, 4, 3, ac);
        } else {
            pix_rect(&c, 5, 11, 18, 11, wl); pix_stroke(&c, 5, 11, 18, 11, dark);
            pix_rect(&c, 11, 15, 6, 7, wood);
            pix_rect(&c, 2, 8, 24, 4, rf); pix_rect(&c, 5, 5, 18, 3, rf); pix_rect(&c, 9, 3, 10, 2, ac);
            pix_rect(&c, 7, 14, 3, 3, glow); pix_rect(&c, 18, 14, 3, 3, glow);
            if (fs[i].mode == 3) { pix_circle(&c, 14, 12, 3, ac); pix_set(&c, 14, 12, dark); }
            else if (fs[i].mode == 4) { pix_rect(&c, 4, 12, 2, 3, ac); pix_rect(&c, 22, 12, 2, 3, ac); }
            else if (fs[i].mode == 5) { pix_circle(&c, 14, 18, 3, ac); }
            else if (fs[i].mode == 6) { pix_circle(&c, 4, 17, 3, ac); pix_circle(&c, 24, 16, 3, ac); }
            else if (fs[i].mode == 7) {
                pix_line(&c, 3, 21, 3, 5, wood, 1); pix_rect(&c, 1, 5, 3, 4, ac);
                pix_line(&c, 25, 21, 25, 5, wood, 1); pix_rect(&c, 24, 5, 3, 4, ac);
            }
        }
        save_pix_card(&c, 104, 90, rgb(0x24313d), rgb(0x10171f), rgb(0xb8903c), rgb(0), false, 6, [NSString stringWithFormat:@"ss_m_%d.png", i+1]);
        pix_free(&c);
    }
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
        printf("Sliced app-icon -> %s\n", gIconOut.UTF8String);
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
        printf("Sliced portraits-sheet -> 13 portraits + f000.png\n");
    }
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        gOutRoot = argc > 1 ? [NSString stringWithUTF8String:argv[1]] : @"/Users/villow/myProject/github/hxsg/apps/web/mapp/assets";
        gRawDir  = argc > 2 ? [NSString stringWithUTF8String:argv[2]] : @"/Users/villow/myProject/github/hxsg/apps/web/mapp/raw-sheets";
        gIconOut = argc > 3 ? [NSString stringWithUTF8String:argv[3]] : @"/Users/villow/myProject/github/hxsg/apps/web/mapp/icon.png";

        NSFileManager *fm = [NSFileManager defaultManager];
        [fm createDirectoryAtPath:[gOutRoot stringByAppendingPathComponent:@"portraits"] withIntermediateDirectories:YES attributes:nil error:nil];

        gen_sprites();
        gen_biomes();
        gen_vfx();
        gen_ui();
        gen_map_thumbs();
        gen_mounts();
        gen_equipment();
        gen_facilities();
        slice_ai_sheets();

        printf("MAPP_ASSET_GEN_OK -> %s\n", gOutRoot.UTF8String);
    }
    return 0;
}
