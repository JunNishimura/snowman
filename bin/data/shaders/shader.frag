#version 150

// デフォルト設定
uniform float u_time;
uniform vec2 u_resolution;
out vec4 outputColor;

const int MAX_MARCHING_STEPS = 255; // ループ回数。この回数分レイを進める
const float MIN_DIST = 0.0; // レイの最短距離
const float MAX_DIST = 100.0; // レイの最大距離
const float EPSILON = 0.0001; // ０に限りなく近い数
const float PI = 3.1415926;
const int oct = 8;
const float per = 0.5;

// raymarchingでもpost-processingで使うのであれば、vec2型の引数で、スクリーンの正規化された値を代入すればよい
float rnd(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

// make noise
float interpolate (float a, float b, float x) {
    float f = (1.0 - cos(x * PI)) * 0.5;
    return a * (1.0 - f) + b * f;
}

float irnd(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec4 v = vec4(rnd(vec2(i.x,     i.y    )),
                  rnd(vec2(i.x+1.0, i.y    )),
                  rnd(vec2(i.x,     i.y+1.0)),
                  rnd(vec2(i.x+1.0, i.y+1.0)));
    return interpolate(interpolate(v.x, v.y, f.x), interpolate(v.z, v.w, f.x), f.y);
}

float noise (vec2 p) {
    float t = 0.0;
    for (int i = 0; i < oct; i++) {
        float freq = pow(2.0, float(i));
        float amp = pow(per, float(oct - i));
        t += irnd(vec2(p.x / freq, p.y / freq)) * amp;
    }
    return t;
}

float snoise(vec2 p, vec2 q, vec2 r) {
    return noise(vec2(p.x,     p.y    )) *     q.x *      q.y +
           noise(vec2(p.x,     p.y+r.y)) *     q.x * (1.0-q.y)+
           noise(vec2(p.x+r.x, p.y    )) *(1.0-q.x)*      q.y +
           noise(vec2(p.x+r.x, p.y+r.y)) *(1.0-q.x)* (1.0-q.y);
}

vec4 value_noise() {
    vec2 p = gl_FragCoord.st + u_time * 100.0;
    float n = snoise(p, gl_FragCoord.st / u_resolution, u_resolution);
    return vec4(vec3(n)*2.50, 1.0);
}

// 引数に乱数
vec4 white_noise_effect(float rand) {
    return vec4(vec3(rand), 1.0);
}

// function of night scope effect
vec4 night_scope_effect(vec3 color, vec2 st, vec3 effect_color) {
    float dest = (color.r + color.b + color.g) / 3.0;
    
    float vignette = 1.5 - length(st);
    dest *= vignette;
    
    float noise = rnd(st+mod(u_time, 10.0));
    dest *= noise * 0.5 + 0.5;
    
    float scanLine = abs(sin(st.y * 20.0 + u_time * 25.0)) * 0.5 + 0.75;
    dest *= scanLine;
    
    return vec4(vec3(dest), 1.0) * vec4(effect_color, 1.0);
}

vec4 odd_Row_Effect(vec3 color) {
    bool isOdd = mod(gl_FragCoord.x - 0.5, 2.0) == 1.0;
    if (isOdd) return vec4(color, 1.0);
    else return vec4(1.0);
}

// pは-1~1の座標値を入れる。
// offsetはずらす値
vec4 createMask(vec2 p, vec2 offset) {
    // aspect比を考慮する場合はコメントアウト
//    p.y /= u_resolution.x / u_resolution.y;
    
    // vignetteでは1.0からlengthで指定した原点からの距離を引くので、この場合だと、1.0を半径とした円が描かれる。length1.0以上だとマイナスになるから、画面が黒くなる
    // clampでは第一要素を第二、第三引数で指定した値の間に抑え込む。この場合だと0.0~1.0に
    float vignette0 = clamp(1.0 - length(p+offset), 0.0, 1.0); // 右
    float vignette1 = clamp(1.0 - length(p-offset), 0.0, 1.0); // 左
    
    // smoothstep用の値。smoothさせる領域。0.5以下は0に。0.55以上は1.0にする。0.5~0.55の間にかけて滑らかに0から1に移っていく。
    float startD = 0.50;
    float endD = 0.55;
    
    // maskを作成.
    // smoothstepでは第三引数が第一引数から第二引数の間にかけて0.0~1.0に移る。第一引数以下では0、第二引数以上では1.0を返す
    // この場合だとvignetteが0.5~0.55の値になる領域にだけ0.0~1.0に滑らかに移るというeffectをかける
    float value = 0.0;
    value += smoothstep(startD, endD, vignette0);
    value += smoothstep(startD, endD, vignette1);
    
    // clampにすることで二つのマスクが重なっても、明るくなることはない
    return vec4(vec3(clamp(value, 0.0, 1.0)), 1.0);
}

// 水玉いっぱいeffect
vec4 mizutama (vec2 st) {
    // マイナスで-0.5~0.5に
    vec2 mod_st = mod(st*5.0, 1.0)-0.5;
    
    vec4 color;
    // １行おきにエフェクト変える
    if (mod(st.x*5.0, 2.0) >= 1.0) {
        float v = clamp((0.5+abs(cos(u_time)*0.5)) - length(mod_st), 0.0, 1.0);
        float vv = smoothstep(0.5, 0.55, v);
        color = vec4(vec3(vv), 1.0);
    } else {
        float v = clamp((0.5+abs(sin(u_time)*0.5)) - length(mod_st), 0.0, 1.0);
        float vv = smoothstep(0.5, 0.55, v);
        color = vec4(vec3(vv), 1.0);
    }
    
    return color;
}

// x軸で回転
mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3 (
                 vec3(1, 0, 0),
                 vec3(0, c, -s),
                 vec3(0, s, c)
                 );
}

// y軸で回転
mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3 (
                 vec3(c, 0, s),
                 vec3(0, 1, 0),
                 vec3(-s, 0, c)
                 );
}

// z軸で回転
mat3 rotateZ(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3 (
                 vec3(c, -s, 0),
                 vec3(s, c, 0),
                 vec3(0, 0, 1)
                 );
}

// xyz同時に回転
// axisはどの軸にどれだけ回転させたいか. もし(1.0, 0.5, 0.0)だとx軸に対して100%y軸に対して50%ということになる
mat3 rotate(float theta, vec3 axis) {
    vec3 a = normalize(axis);
    float c = cos(u_time);
    float s = sin(u_time);
    float r = 1.0 - c;
    return mat3 (
                 a.x * a.x * r + c,
                 a.y * a.x * r + a.z * s,
                 a.z * a.x * r - a.y * s,
                 a.x * a.y * r - a.z * s,
                 a.y * a.y * r + c,
                 a.z * a.y * r + a.x * s,
                 a.x * a.z * r + a.y * s,
                 a.y * a.z * r - a.x * s,
                 a.z * a.z * r + c
                 );
}

// intersetSDFでは、重なった部分のみを描写する
// 前提として、negative値または限りなく０に近い値をdistance functionとして返すと、そこがオブジェクトの表面として画面に描かれる
// 両方がnegative値または限りなく０に近い値を示す場合、それはまさに両方が重なっている場合、のみmax関数でも小さい値を返すことになるので描画される。
float intersectSDF(float distA, float distB) {
    return max(distA, distB);
}

// unionSDFでは字の通り複数オブジェクトを合体させる
// オブジェクトが描かれるのは限りなく値が小さいときというのを思い出すと、なぜmin関数で複数オブジェクトが描かれるのかはわかる
float unionSDF(float distA, float distB) {
    return min(distA, distB);
}

// differenceSDFでは複数オブジェクトの差分を利用して描画する
// max関数だから、両方のオブジェクトが小さい値のみ描画される。
// -distBだから、符合が逆転して、もともとobjectとして描かれた所の値がプラスの大きな値を持って、もともとobjectの外側だった部分の値がマイナスの値を持つことになる。
// その状態で第一引数の値が０に限りなく近い値を返すところでオブジェクトを描くので結果として、第一引数のオブジェクトから第二引数のオブジェクトを引いたようになる
float differenceSDF(float distA, float distB) {
    return max(distA, -distB);
}

float smoothMin(float d1, float d2, float k) {
    float h = exp( -k * d1 ) + exp( -k * d2 );
    return -log(h) / k;
}


// simple sphere
// この関数が0.0を返せばsphereの表面。+ならoutside,-ならinside。
// 1(sphereSize) = x^2 + y^2 + z^2 を x^2 + y^2 + z^2がlength()でそこから1を右辺に移動させ、=0で方程式が成り立つ場合にsphereを描く
// sphereの中心を原点として、そこから半径1(sphereSize)をとる球体を置いて、各レイの先端位置との距離を測る
float sphereSDF(vec3 samplePoint, float sphereSize) {
    return length(samplePoint) - sphereSize;
}


// distance function of cube
float cubeSDF(vec3 p, vec3 cubeSize) {
    // 各点の絶対値からcubeの大きさをひく（cubeの大きさは実際にはcubeSizeの二倍になる）
    // insideは0またはマイナス値なる。outsideは0またはプラス値になる
    vec3 d = abs(p) - cubeSize;
    float insideDistance = min(max(d.x, max(d.y, d.z)), 0.0);
    float outsideDistance = length(max(d, 0.0));
    return insideDistance + outsideDistance;
}

// round cube
// 基本上のcubeと同じで、角を丸めるために変数roundを用意して、最終結果でround分を引く
float cubeSDF_round(vec3 p, vec3 cubeSize) {
    // round : どれだけ丸みを帯びさせるか // この値だけ外側に膨らませる(その分オブジェクトが大きくなる)
    float round = 0.1;
    vec3 d = abs(p) - cubeSize;
    float insideDistance = min(max(d.x, max(d.y, d.z)), 0.0);
    float outsideDistance = length(max(d, 0.0));
    return (insideDistance + outsideDistance) - round;
}

float coneSDF( vec3 p, vec3 c ) {
    vec2 q = vec2( length(p.xz), p.y );
    float d1 = -q.y - c.z;
    float d2 = max( dot(q,c.xy), q.y );
    float insideDistance = min( max(d1,d2), 0.0 );
    float outsideDistance = length( max(vec2(d1,d2),0.0) );
    return insideDistance + outsideDistance;
}

// distance function of cylinder
// h : height
// r : radius
float cylinderSDF( vec3 p, float h, float r) {
    // 単純にxy座標において、半径rの円内にあるかどうか。半径ないならマイナス値で半径外ならプラス値になる。円上なら0になる
    float inOutRadius = length(p.xy) - r;
    // 単純にz軸の絶対値をとることで、原点からの純粋な距離を測りそこから円柱のHeightの半分だけ引く。(半分なのは原点を挟んでいて、z軸の絶対値から引いているから)
    float inOutHeight = abs(p.z) - h/2.0;
    // もし円柱の内側なら両方がマイナス値なので、そのマイナス値が返される。他は０になる
    float insideDistance = min(max(inOutRadius, inOutHeight), 0.0);
    // もし円柱の内側なら両方がマイナス値なので、max関数で０になる。もしoutsideなら０以上のプラス値が返させる。
    float outsideDistance = length(max(vec2(inOutRadius, inOutHeight), 0.0));
    // 0もしくは,限りなく０に近い値を返す点において、オブジェクトを描く
    return insideDistance + outsideDistance;
}

// distance function of eacy clinder
// 両端が切れないcylinder
// 操作性低い
float easyCylinderSDF (vec3 p) {
    // 0にセットすると原点からの距離を測れる
    vec2 c = vec2(0.0, 0.0);
    // radius
    float radius = 0.5;
    // ここでpのxyzの中の２つだけしか使わないことで両端が切れないcylinderを描ける
    // 単純に原点からの距離を測ってradiusで引く。その値が限りなく0に近い値であれば、そこが表面
    return length(p.yz - c.xy) - radius;
}

float torusSDF(vec3 p, vec2 t) {
    vec2 r = vec2(length(p.xz)-t.x, p.y);
    return length(r) - t.y;
}

float fl_torusSDF(vec2 base, float up, vec2 t) {
    vec2 r = vec2(length(base)-t.x, up);
    return length(r) - t.y;
}

float planeSDF(vec3 p, vec4 nn) {
    // n must be normalized
    vec3 n = normalize(nn.xyz);
    return dot(p, n) + nn.w;
}

vec4 unionWithSmoothSDF(vec4 d1, vec4 d2, float k) {
    float smooth_d = smoothMin(d1.w, d2.w, k);
    vec4 s = d1.w < d2.w ? d1 : d2;
    s.w = smooth_d;
    return s;
}

// .wで距離だけを比べて、値が小さい方のベクトルを返す
vec4 unionSDF2(vec4 d1, vec4 d2) {
    return d1.w < d2.w ? d1 : d2;
}

// .wで距離だけを比べて、値が大きい方のベクトルを返す
vec4 intersectSDF2(vec4 d1, vec4 d2) {
    return d1.w > d2.w ? d1 : d2;
}

// .wで距離だけを比べて、値が大きい方のベクトルを返す
vec4 differenceSDF2(vec4 d1, vec4 d2) {
    return d1.w > -d2.w ? d1 : d2;
}

vec4 sceneSDF(vec3 samplePoint) {
    samplePoint.y = samplePoint.y * (abs(sin(u_time*1.2))*0.4 + 1.0);
    
    // make the body
    float body1 = sphereSDF(samplePoint+vec3(0.0, 0.50, 0.0), .55);
    float body2 = sphereSDF(samplePoint+vec3(0.0, -0.2, 0.0), .35);
    vec4 b1 = vec4(vec3(0.9, 0.9, 0.9), body1);
    vec4 b2 = vec4(vec3(0.9, 0.9, 0.9), body2);
//    vec4 body = unionWithSmoothSDF(b1, b2, 9.0); // apply the smoothness to the neck
    vec4 body = unionSDF2(b1, b2);
    
    // make the eyes
    float eye_r = sphereSDF(samplePoint+vec3(-0.2, -0.2, -0.3), 0.05); // right eye
    float eye_l = sphereSDF(samplePoint+vec3(0.2, -0.2, -0.3), 0.05);
    vec4 e1 = vec4(vec3(0.0, 0.0, 0.0), eye_r);
    vec4 e2 = vec4(vec3(0.0, 0.0, 0.0), eye_l);
    vec4 eyes = unionSDF2(e1, e2);
    
    // make the scarf
    float s = torusSDF(samplePoint+vec3(0.0, 0.05, 0.0), vec2(0.25, 0.08));
    vec4 torus = vec4(vec3(0.7, 0.1, 0.0), s);
    
    // make the hat
    
    float c = coneSDF(samplePoint+vec3(0.0, -1.0, 0.0), normalize(vec3(0.75, .30, 0.5))); // メインcone
    float c_t = torusSDF(samplePoint+vec3(0.0, -.52, 0.0), vec2(0.2, 0.07)); // cone下のtorus
    float c_b = sphereSDF(samplePoint+vec3(0.0, -0.95, 0.0), 0.08); // cone上のball
    vec4 cone = vec4(vec3(1.0, 0.0, 0.0), c);
    vec4 torus_under_cone = vec4(vec3(1.2, 1.2, 1.2), c_t);
    vec4 sphere_over_cone = vec4(vec3(1.2, 1.2, 1.2), c_b);
    cone = unionSDF2(cone, torus_under_cone);
    cone = unionSDF2(cone, sphere_over_cone);
    
    // make a nose
    vec3 n_pos = samplePoint * rotateX(-radians(90.0));
    // n_posで90回転しているから、yが元のzでzが元のyっていう風に変わる。常にトンガリの頭がy軸さしてるって感じかな。
    float n = coneSDF(n_pos+vec3(0.0, -0.5, .16), normalize(vec3(0.2, 0.05, 0.05)));
    vec4 nose = vec4(vec3(0.5, 0.25, 0.0), n);
    
    // make hands
    // rotateとtransform（移動）を重ねるときは先に移動させてから回転させないと、transformからのrotateだと、オブジェクトの向きが変わっているから移動が面倒くさくなる
    // rotateを重ねるときも1回目以降はオブジェクト主体で2回目以降の回転の向きを変える必要がある。
    // 下のやつだとカメラ目線だと2回目はrotateZだけど、rotateYで回った後のobject目線で考えると、rotateXの上下への回転がスクリーン上には結果としてrotateZしたような画になる
    // left hand
    vec3 h1_l_pos = samplePoint + vec3(0.6, -0.02, 0.0);
    h1_l_pos = h1_l_pos * rotateY(radians(90.0)) * rotateX(radians(45.0));
    float h1_l = cylinderSDF(h1_l_pos, 0.5, 0.033);
    vec3 h2_l_pos = samplePoint + vec3(0.6, -0.123, 0.0);
    h2_l_pos = h2_l_pos * rotateY(radians(90.0)) * rotateX(radians(-80.0));
    float h2_l = cylinderSDF(h2_l_pos, 0.2, 0.03);
    vec3 h3_l_pos = samplePoint + vec3(0.69, -0.045, 0.0);
    h3_l_pos = h3_l_pos * rotateY(radians(90.0)) * rotateX(radians(10.0));
    float h3_l = cylinderSDF(h3_l_pos, 0.2, 0.03);
    // right hand
    vec3 h1_r_pos = samplePoint + vec3(-0.6, -0.02, 0.0);
    h1_r_pos = h1_r_pos * rotateY(radians(90.0)) * rotateX(radians(-45.0));
    float h1_r = cylinderSDF(h1_r_pos, 0.5, 0.033);
    vec3 h2_r_pos = samplePoint + vec3(-0.6, -0.123, 0.0);
    h2_r_pos = h2_r_pos * rotateY(radians(90.0)) * rotateX(radians(80.0));
    float h2_r = cylinderSDF(h2_r_pos, 0.2, 0.03);
    vec3 h3_r_pos = samplePoint + vec3(-0.69, -0.045, 0.0);
    h3_r_pos = h3_r_pos * rotateY(radians(90.0)) * rotateX(radians(-10.0));
    float h3_r = cylinderSDF(h3_r_pos, 0.2, 0.03);
    // merge left and right hands
    vec3 h_c = vec3(0.7, 0.4, 0.0); // color of the hands
    vec4 hand = vec4(h_c, h1_l);
    hand = unionSDF2(hand, vec4(h_c, h2_l));
    hand = unionSDF2(hand, vec4(h_c, h3_l));
    hand = unionSDF2(hand, vec4(h_c, h1_r));
    hand = unionSDF2(hand, vec4(h_c, h2_r));
    hand = unionSDF2(hand, vec4(h_c, h3_r));
    
    // make buttons
    float bt_size = 0.065;
    float bt1 = sphereSDF(samplePoint+vec3(0.0, 0.7, -0.50), bt_size);
    float bt2 = sphereSDF(samplePoint+vec3(0.0, 0.45, -0.52), bt_size);
    float bt3 = sphereSDF(samplePoint+vec3(0.0, 0.24, -0.46), bt_size);
    vec3 bt_color = vec3(1.0, 0.0, 0.0);
    vec4 buttons = vec4(bt_color, bt1);
    buttons = unionSDF2(buttons, vec4(bt_color, bt2));
    buttons = unionSDF2(buttons, vec4(bt_color, bt3));
    
    // make mouth
    vec2 tr_1_pos = samplePoint.xy + vec2(0.0, -0.13);
    if (tr_1_pos.y > 0.0) tr_1_pos.y = 100.0;
    float tr_1 = fl_torusSDF(tr_1_pos, samplePoint.z-0.3, vec2(0.08, 0.025));
    vec4 mouth = vec4(vec3(0.0), tr_1);
    
    // make ground
    float gr1 = planeSDF(samplePoint, vec4(0.0, 1.0, 0.0, 1.5));
    vec3 gr_col = vec3(1.0);
    vec4 ground = vec4(gr_col, gr1);
    
    // the final output of the snowman
    vec4 snowman = unionSDF2(body, eyes);
    snowman = unionSDF2(snowman, torus);
    snowman = unionSDF2(snowman, cone);
    snowman = unionSDF2(snowman, nose);
    snowman = unionSDF2(snowman, hand);
    snowman = unionSDF2(snowman, buttons);
    snowman = unionSDF2(snowman, mouth);
    snowman = unionSDF2(snowman, ground);
    return snowman;
}




// ここでレイを作る。
// xy方向は単に -u_resolution/2 ~ u_resolution/2 に座標変換したスクリーンのxyを入れる。
// z方向に関してはfieldOfViewの角度に応じて、z軸方向へのレイの大きさを変える
vec3 rayDirection(float fieldOfView) {
    vec2 xy = gl_FragCoord.xy - u_resolution / 2.0;
    float z = u_resolution.y / tan(radians(fieldOfView)/2.0);
    return normalize(vec3(xy, -z));
}

// ここでレイを実際に飛ばしてオブジェクトまでの距離を測る。
// eye : eye point。レイの初期位置にeyeと仮定しておく。(人間にとってその方がわかりやすいだけ)
// marchingDirection : レイの方向。ここは単にレイを入れるだけ。
// start : 初期状態でレイがカメラからどれだけ離れているか
// end : カメラからのレイの最大距離。これ以上のレイの値を追うことはしない。
float shortestDistanceToSurface(vec3 eye, vec3 marchingDirection, float start, float end) {
    float depth = start;
    for ( int i = 0; i < MAX_MARCHING_STEPS; i++ ) {
        float rayPos = sceneSDF( eye + depth * marchingDirection ).w;
        // EPSILONより小さい、つまりオブジェクトの表面だとわかり次第をreturnでdepthを返してループを抜ける
        if ( rayPos < EPSILON ) {
            return depth;
        }
        // レイを進める
        depth += rayPos;
        // depthが最大距離を超えるとendを返してループを抜ける
        if ( depth >= end ) {
            return end;
        }
    }
    // returnされなかったものに対してもendを返す
    return end;
}

// floatではなくベクトルで返す
// ちょっぴり面倒なのは、endもベクトルで返さないといけないこと
vec2 shortestDistanceToSurface2(vec3 eye, vec3 marchingDirection, float start, float end) {
    // depthをベクトルとして扱う。
    // 第一要素にはレイの深さ。つまりこの値はどんどん大きくなる
    // 第二要素はレイの先端位置（オブジェクトとの距離）。objectと交差しないのであれば値は開いていくが、もし交差するのであればどんどんobjectに近づくわけだから、値は小さくなる
    vec2 depth;
    vec2 max = vec2(end);
    depth.x = start;
    for ( int i = 0; i < MAX_MARCHING_STEPS; i++ ) {
        depth.y = sceneSDF( eye + depth.x * marchingDirection ).w;
        
        if ( depth.y < EPSILON ) {
            // ベクトルdepthにまとめることで、レイの深さとobjectとの距離の両方を返せる。
            // このdepthはEPSILON以下であることを条件として返すわけだから、非常に小さい(極めて０に近い)値を返す
            return depth;
        }
        // レイを進める
        depth.x += depth.y;
        // depthが最大距離を超えるとendを返してループを抜ける
        if ( depth.x >= max.x ) {
            return max;
        }
    }
    // returnされなかったものに対してもendを返す
    return max;
}



// SDFの勾配を求めて、各ポイントにおける法線を算出。
vec3 estimateNormal(vec3 p) {
    return normalize(vec3(
                          sceneSDF(vec3(p.x + EPSILON, p.y, p.z)).w - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)).w,
                          sceneSDF(vec3(p.x, p.y + EPSILON, p.z)).w - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)).w,
                          sceneSDF(vec3(p.x, p.y, p.z + EPSILON)).w - sceneSDF(vec3(p.x, p.y, p.z - EPSILON)).w
    ));
}


// the function for generating shadow
float genShadow(vec3 refpos, vec3 raydir) {
    float h = 0.0;
    float c = 0.01;
    float r = 1.0;
    float shadowCoef = 0.5;
    for (float t = 0.0; t < 10.0; t++) {
        h = sceneSDF( refpos + raydir * c ).w;
        if ( h < 0.001 ) {
            return shadowCoef;
        }
        r = min(r, h * 16.0 / c);
        c += h;
    }
    return 1.0 - shadowCoef + r * shadowCoef;
}



// k_d : diffuse color
// k_s : specular color
// alpha : shininess coefficient
// p : position of point begin lit
// eye : position of the camera
// lightPos : the position of the light
// lightIntensity : color/light intensity of the lihgt
vec3 phongContribForLight(vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye, vec3 lightPos, vec3 lightIntensity) {
    vec3 N = estimateNormal(p); // N : Normal
    vec3 L = normalize(lightPos-p); // L : pから光源方向へのベクトル
    vec3 R = normalize(reflect(-L, N)); // R : 反射ベクトル（光源から点pに向かって放たられる光に対する反射）
    vec3 V = normalize(eye-p); // pから目線（カメラ位置）方向へのベクトル
    
    float dotLN = dot(L, N); // ベクトルLとNの内積を計算
    float dotRV = dot(R, V); // ベクトルRとVの内積を計算
    
    if ( dotLN < 0.0 ) {
        // もし内積が０以下、つまり二つのベクトルが９０以上開いていたらライトを消す（0を返す）
        return vec3 (0.0, 0.0, 0.0);
    }
    if ( dotRV < 0.0 ) {
        // pから目線方向へのベクトルと反射ベクトルの角度が９０以上開いていたらdiffuseのみを適用する
        return lightIntensity * (k_d*dotLN);
    }
    return lightIntensity * (k_d*dotLN+k_s*pow(dotRV, alpha));
}

// vec3で返される値は反射後のRGBカラーの値。
// k_a : ambient color
// k_d : diffuse color
// k_s : specular color
// alpha : shininess coefficient. この定数が大きいほど、鏡面ハイライトが小さく強くなる
// p : position of point beging lit
// eye : position of camera
vec3 phongillumination(vec3 k_a, vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye, vec2 dist ) {
    const vec3 ambientLight = 0.5 * vec3(1.0, 1.0, 1.0);
    vec3 color = ambientLight * k_a;
    vec3 light1Pos = vec3(4.0*sin(u_time),
                          2.0,
                          4.0*cos(u_time));
    vec3 light1Intensity = vec3(0.4, 0.4, 0.4);
    color += phongContribForLight(k_d, k_s, alpha, p, eye, light1Pos, light1Intensity);
    
//    vec3 light2Pos = vec3(2.0 * sin(0.37 * u_time),
//                          2.0 * cos(0.37 * u_time),
//                          2.0);
//    vec3 light2Intensity = vec3(0.4, 0.4, 0.4);
//    color += phongContribForLight(k_d, k_s, alpha, p, eye, light2Pos, light2Intensity);
    
    
    float shadow = 1.0;
    // here we generate tiles
    if ( abs(dist.y) < EPSILON && p.y < -1.0) {
        vec3 normal = estimateNormal(p);
        float diff = clamp(dot(light1Pos, normal), 0.5, 1.0);
        //        diff += clamp(dot(light2Pos, normal), 0.1, 1.0);
        
        shadow = genShadow(p + normal*0.001, light1Pos);
        
        // 波紋を描く
        float col = mod(length(p)-u_time, 2.0);
        
        color *= vec3(col);
    }
    
    // 一定の時間を境にノイズを雪だるまに走らせる
    if (  p.y > -1.0) {
//        color *= value_noise().rgb;
    }
    
    return color  * max(shadow, 0.5);
}


// viewMatrixを作る。カメラ中心の座標にする。
mat4 viewMatrix(vec3 eye, vec3 center, vec3 up) {
    vec3 f = normalize( center - eye );
    vec3 s = normalize( cross(f, up) );
    vec3 u = cross(s, f);
    return mat4 (
        vec4(s, 0.0),
        vec4(u, 0.0),
        vec4(-f, 0.0),
        vec4(0.0, 0.0, 0.0, 1.0)
    );
}




void main () {
    // スクリーン座標を上下左右を-1~1にする (左下が-1, -1で右上が1,1)
    vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // fieldOfViewの角度を渡してレイを作成
    vec3 viewDir = rayDirection(45.0);
    // カメラの位置を決める
    vec3 eye = vec3(cos(u_time*0.5)*8.0, 2.5, sin(u_time*0.5)*8.0);
//    vec3 eye = vec3(8.0, 5.0, 7.0);
//    vec3 eye = vec3(-5.0, 0.0, 0.0); // side camera
//    vec3 eye = vec3(0.0, 0.0, 7.5); // front camera
//    vec3 eye = vec3(0.0, 6.0, 0.10); // top camera
    
    // viewMatrixを作る。ここでカメラ中心の座標にする(openGLの行列チュートリアル見ると分かりやすい)
    mat4 viewToWorld = viewMatrix(eye, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
    // ここで上でつくったカメラ中心の座標にたいして、各ピクセルに放たれるレイのベクトルを掛け合わせる。
    // 要するにここら辺ではカメラに対応するように座標変換している
    vec3 worldDir = (viewToWorld * vec4(viewDir, 0.0)).xyz;
    
    vec2 dist = shortestDistanceToSurface2( eye, worldDir, MIN_DIST, MAX_DIST );
    
    // distではoutsideならMAX_DISTが入る。(shortestDistanceToSurfaceでMAX_DISTが返されている)
    // だからMAX_DISTから小さな値を引いた数より大きい場合は、ピクセルを黒で塗りつぶす。
    // dist >= MAX_DISTでも同じ効果が得られる。
    if( dist.x > MAX_DIST - EPSILON ) {
        outputColor = vec4(0.0);
        return;
    }

    vec3 surfPos = eye + dist.x * worldDir;
    
    vec3 K_a = sceneSDF(surfPos).rgb;
    vec3 K_d = sceneSDF(surfPos).rgb;
    vec3 K_s = vec3(1.0, 1.0, 1.0);
    float shininess = 10.0;
    
    vec3 color = phongillumination( K_a, K_d, K_s, shininess, surfPos, eye, dist );
    
    outputColor = vec4(color, 1.0);
    
    /////// post-processing ///////
    
    float t = u_time*0.75;
    
    // night scope effect
    if (mod(t, 10.0) > 8.0) {
        outputColor *= night_scope_effect(color, st, vec3(0.9, 0.9, 0.7));
        outputColor *= value_noise();
    } else if (mod(t, 10.0) > 7.0 && mod(t, 4.0) < 8.0) {
        outputColor *= mizutama(st);
    } else if (mod(t, 10.0) > 6.0 && mod(t, 4.0) < 7.0) {
        outputColor *= createMask(st, vec2(cos(u_time), sin(u_time)));
    }
}
