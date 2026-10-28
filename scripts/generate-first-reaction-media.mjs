import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import ffmpeg from 'ffmpeg-static'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'public/games/first-reaction/media')
const content = JSON.parse(await fs.readFile(path.join(root, '../russian-gg-server/src/RussianGg.Application/SpeakingGames/Data/content.json'), 'utf8'))
const scenes = [...new Set(content.situations.map(({ scene }) => scene.replace(/\.gif$/, '')))]
const frames = 12
const fps = 6
const r = (x, y, w, h, fill, radius = 12, rest = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" ${rest}/>`
const c = (x, y, radius, fill, rest = '') => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" ${rest}/>`
const e = (x, y, rx, ry, fill, rest = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${rest}/>`
const p = (d, fill, rest = '') => `<path d="${d}" fill="${fill}" ${rest}/>`
const line = (d, stroke = '#e9f1ff', width = 5, rest = '') => p(d, 'none', `stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${rest}`)
const text = (x, y, value, size = 25, fill = '#f4f7ff') => `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" fill="${fill}">${value}</text>`
const group = (x, y, s, body, rest = '') => `<g transform="translate(${x} ${y}) scale(${s})" ${rest}>${body}</g>`
const star = (x, y, s = 1, fill = '#ffe59c') => group(x, y, s, p('M0-16 5-5 16 0 5 5 0 16-5 5-16 0-5-5Z', fill))
const smile = (x, y) => c(x - 12, y, 3, '#292253') + c(x + 12, y, 3, '#292253') + line(`M${x - 9} ${y + 12}Q${x} ${y + 20} ${x + 9} ${y + 12}`, '#292253', 3)
const bubble = (x, y, value = '…', scale = 1) => {
  const width = Math.max(88, value.length * 16 + 20)
  return group(x, y, scale, r(-width / 2, -30, width, 52, 'url(#white)', 20) + p('M-21 16-30 37-2 21', '#e4f5ff') + text(0, 4, value, value.length > 4 ? 25 : 28, '#50499c'))
}
const shadow = (x = 320, w = 160, y = 296) => e(x, y, w, 15, '#130a4f', 'opacity=".45"')
const float = (body, phase, scale = 1) => `<g transform="translate(0 ${Math.sin(phase) * 4 * scale})">${body}</g>`

function person(x, y, scale = 1, color = 'url(#purple)', pose = 'normal', opacity = 1) {
  const arms = pose === 'up' ? line('M-25 42-48 4M25 42 48 4', '#b5c0ff', 15) : pose === 'run' ? line('M-24 41-44 58M24 41 43 24', '#b5c0ff', 15) : line('M-25 42-38 79M25 42 38 79', '#b5c0ff', 15)
  return group(x, y, scale, `<g opacity="${opacity}">${arms}${line('M-12 80-17 120M12 80 21 120', '#384293', 16)}${r(-29, 28, 58, 65, color, 21)}${c(0, 0, 28, 'url(#skin)')}${p('M-28-1Q-34-38 3-33 33-30 28-4L12-17-19-13Z', '#252151')}${smile(0, 0)}${r(-30, 113, 25, 13, '#e2eaff', 6)}${r(10, 113, 25, 13, '#e2eaff', 6)}</g>`)
}

function cat(x, y, scale = 1, phase = 0, color = 'url(#gold)') {
  return group(x, y, scale, line(`M43 57Q${82 + Math.sin(phase) * 8} 33 65 5`, '#ffb86d', 15) + e(0, 53, 40, 43, color) + p('M-40-8-38-47-9-24M40-8 38-47 9-24', color) + p('M-33-15-31-34-18-23M33-15 31-34 18-23', '#ff8db8') + e(0, 0, 47, 36, color) + c(-17, -5, 5, '#302c64') + c(17, -5, 5, '#302c64') + p('M-6 7 6 7 0 13Z', '#e76e99') + line('M0 13Q-7 24-15 16M0 13Q7 24 15 16', '#68416d', 2.5) + line('M-26 11-51 6M-26 19-51 21M26 11 51 6M26 19 51 21', '#715079', 2) + e(-22, 89, 17, 8, '#ffe6a8') + e(22, 89, 17, 8, '#ffe6a8'))
}

function dog(x, y, scale = 1, phase = 0, angry = false) {
  return group(x, y, scale, line(`M42 55Q${85 + Math.sin(phase) * 9} 12 68 0`, '#eaa47d', 14) + e(0, 48, 39, 42, 'url(#gold)') + e(-40, -1, 16, 36, '#c87b78', 'transform="rotate(15 -40 -1)"') + e(40, -1, 16, 36, '#c87b78', 'transform="rotate(-15 40 -1)"') + e(0, -3, 42, 36, 'url(#gold)') + e(0, 15, 24, 17, '#fff0c4') + c(-15, -7, 4, '#302c64') + c(15, -7, 4, '#302c64') + e(0, 7, 8, 6, '#3b315c') + (angry ? line('M-24-20-10-15M24-20 10-15M-9 24 9 24', '#4b305b', 4) : line('M-10 22Q0 33 10 22', '#68416d', 3)) + r(-31, 28, 62, 10, '#8479ee', 5) + c(0, 41, 7, '#ffe58a') + e(-22, 85, 17, 9, '#ffe3b0') + e(22, 85, 17, 9, '#ffe3b0'))
}

function house(x, y, scale = 1, windows = '#9beeff') {
  return group(x, y, scale, r(-80, -23, 160, 128, 'url(#white)', 9) + p('M-103-22 0-104 103-22Q107-13 98-10H-98Q-108-12-103-22', 'url(#pink)') + r(42, -84, 24, 41, '#b28bff', 4) + r(-56, 7, 37, 39, windows, 7) + r(22, 7, 37, 39, windows, 7) + line('M-38 8V45M23 26H57M-55 26H-20M41 8V45', '#b9b9ef', 3) + r(-18, 48, 39, 57, 'url(#purple)', 6) + c(9, 80, 3, '#ffe296'))
}

function phone(x, y, scale = 1, face = true) {
  return group(x, y, scale, r(-45, -81, 90, 164, '#292858', 19) + r(-38, -73, 76, 145, 'url(#cobalt)', 13) + r(-19, -70, 38, 9, '#292858', 4) + (face ? smile(0, -2) : '') + r(-13, 63, 26, 4, '#d2dbff', 2))
}

function clock(x, y, scale = 1, phase = 0) {
  return group(x, y, scale, c(0, 0, 62, 'url(#gold)') + c(0, 0, 51, 'url(#white)') + Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return c(Math.sin(a) * 42, -Math.cos(a) * 42, 2.4, '#8e80c3') }).join('') + line(`M0 0 0-29M0 0 ${Math.cos(phase) * 26} ${Math.sin(phase) * 26}`, '#6353c5', 5) + c(0, 0, 5, '#ff7dac'))
}

function bed(x, y, scale = 1) {
  return group(x, y, scale, r(-112, -12, 224, 70, '#7762c5', 12) + r(-117, -57, 16, 137, 'url(#purple)', 6) + r(101, 17, 16, 63, 'url(#purple)', 6) + r(-98, -22, 190, 32, 'url(#white)', 11) + r(-94, -34, 65, 32, '#e8dcff', 12) + r(-23, -20, 119, 56, 'url(#mint)', 10))
}

function coin(x, y, scale = 1, rotate = 0) {
  return group(x, y, scale, `<g transform="rotate(${rotate})">${c(0, 0, 28, '#e69c43')}${c(-3, -3, 25, 'url(#gold)')}${c(-3, -3, 18, 'none', 'stroke="#e8a149" stroke-width="2"')}${text(-3, 5, '$', 25, '#c08035')}</g>`)
}

const coins = (phase = 0) => coin(248, 222, 1.1, -12) + coin(294, 257, .9) + coin(369, 224, 1.2, 14) + float(coin(319, 151, 1.3), phase) + coin(415, 264, .7)
const briefcase = (x, y, s = 1) => group(x, y, s, r(-21, -47, 42, 26, 'none', 7, 'stroke="#b7a8ff" stroke-width="8"') + r(-68, -29, 136, 92, 'url(#purple)', 14) + line('M-67 1Q0 32 67 1', '#b2a0ef', 3) + r(-12, 9, 24, 20, 'url(#gold)', 5))
const trophy = (x, y, s = 1) => group(x, y, s, line('M-43-43Q-99-48-65 0L-40 8M43-43Q99-48 65 0L40 8', '#ffca70', 11) + p('M-47-59H47V-26Q45 25 0 32-45 25-47-26Z', 'url(#gold)') + r(-8, 26, 16, 39, '#e9a54b', 3) + r(-38, 61, 76, 16, 'url(#gold)', 6) + star(0, -18, 1.1, '#fff3be'))
const gift = (x, y, s = 1) => group(x, y, s, line('M0-39Q-67-98-48-45L0-32Q67-98 48-45L0-32', '#ffd8a0', 9) + r(-68, -29, 136, 94, 'url(#pink)', 8) + r(-75, -36, 150, 24, '#ffc1df', 6) + r(-10, -36, 20, 101, 'url(#gold)', 3))
const cloud = (x, y, s = 1) => group(x, y, s, p('M-57 15Q-83 11-67-13-56-27-35-20-32-55 0-52 29-50 34-25 60-37 74-14 91 16 56 21H-52Z', 'url(#white)'))
const tree = (x, y, s = 1) => group(x, y, s, r(-8, -13, 16, 112, '#80628d', 4) + p('M0-125 61-32H37L75 27H-75L-37-32H-61Z', 'url(#mint)') + line('M0-72V48M0-18-25-38M0 9 29-14', '#58bcb6', 3))
const plane = (x, y, s = 1, tilt = -10) => group(x, y, s, `<g transform="rotate(${tilt})">${p('M-107 0-34-13-54-66-29-68 19-18 87-13Q120 0 86 12L19 16-29 66-54 63-34 12-107 4-120 31-133 28-127-1-133-29-120-32Z', 'url(#white)')}${line('M62-7 76-6M35-7 42-7', '#7c8fe3', 5)}</g>`)
const book = (x, y, s = 1, color = 'url(#purple)') => group(x, y, s, r(-58, -78, 116, 155, '#c7c3ff', 10) + r(-58, -82, 109, 151, color, 8) + line('M-44-73V60', '#b9b0ff', 3) + star(7, -22, 1.5) + line('M-23 24H30M-15 37H22', '#d9dbff', 5))
const desk = (x, y, s = 1) => group(x, y, s, r(-112, 0, 224, 14, 'url(#pink)', 5) + r(-92, 12, 13, 77, '#7b74c2', 4) + r(79, 12, 13, 77, '#7b74c2', 4))
const laptop = (x, y, s = 1) => group(x, y, s, r(-54, -54, 108, 71, '#35346d', 8) + r(-47, -47, 94, 56, 'url(#cobalt)', 4) + p('M-54 17H54L74 29Q74 36 64 36H-64Q-74 36-74 29Z', '#c4ceff'))
const document = (x, y, s = 1, symbol = '✓') => group(x, y, s, p('M-57-74H25L57-42V77H-57Z', 'url(#white)') + p('M25-74V-42H57', '#b8c3ef') + line('M-35 20H32M-35 36H32M-35 52H8', '#b4b6e1', 5) + c(0, -22, 25, 'url(#mint)') + text(0, -12, symbol, 30, '#257b95'))
const wing = (x, y, s = 1, flip = false) => group(x, y, s, `<g transform="scale(${flip ? -1 : 1} 1)">${p('M0 29Q-83 28-106-61-83-50-58-17-71-62-56-83-38-64-17-20-21-60-4-66 14-29 0 29', 'url(#white)')}${line('M-8 16Q-56-8-80-40', '#bcbdec', 3)}</g>`)
const wand = (x, y, s = 1, rotation = 0) => group(x, y, s, `<g transform="rotate(${rotation})">${r(-7, -50, 14, 139, 'url(#purple)', 5)}${r(-7, -50, 14, 35, 'url(#white)', 4)}${star(0, -64, 1.5)}</g>`)
const globe = (x, y, s = 1) => group(x, y, s, c(0, 0, 67, 'url(#cobalt)') + p('M-55-28-30-50-4-56 10-33-10-14-6 12-24 25-49 7ZM23-5 57-18 64 8 40 28 24 59 9 32Z', '#7ee8c9') + e(0, 0, 36, 67, 'none', 'stroke="#c2fbf6" stroke-width="2" opacity=".45"') + line('M-64-20Q0 3 64-20M-64 22Q0 45 64 22', '#c2fbf6', 2, 'opacity=".45"'))
const eye = (x, y, s = 1) => group(x, y, s, p('M-76 0Q0-80 76 0 0 80-76 0', 'url(#white)') + c(0, 0, 29, 'url(#cobalt)') + c(0, 0, 13, '#34316e') + c(-8, -10, 6, '#fff'))
const flame = (x, y, s = 1) => group(x, y, s, p('M0-80Q15-28 36-42 75 27 28 62-26 90-42 30-56-5-24-28-34 8-10 2 0-80', 'url(#pink)') + p('M0-22Q5 0 19 0 44 41 7 57-28 53-20 24Z', 'url(#gold)'))
const question = (x, y, s = 1) => group(x, y, s, c(0, 0, 26, 'url(#pink)') + text(0, 10, '?', 31))

function sceneBody(name, phase) {
  const bob = Math.sin(phase)
  switch (name) {
    case 'elephant_in_room':
      return r(144, 76, 352, 210, '#8e79ce', 12) + r(170, 96, 76, 77, '#7bcbea', 8) + line('M208 98V170M173 133H243', '#d2baf4', 4) + r(408, 197, 62, 85, '#59439a', 9) + shadow(318, 141) + group(323, 203 + bob * 3, 1.1, e(0, 0, 91, 62, 'url(#lilac)') + r(-69, 35, 28, 48, '#9c96df', 11) + r(31, 35, 28, 48, '#9c96df', 11) + c(-62, -31, 53, 'url(#lilac)') + e(-36, -25, 30, 39, '#b6a1ed') + line('M-104-15Q-130 41-94 56', '#b6b3f1', 26) + c(-85, -41, 5, '#37336b') + p('M-96-9-105 14-83 2Z', '#fff2db') + line('M89-7Q111 5 103 24', '#b6b3f1', 5)) + bubble(442, 112, '!', .8)
    case 'cat_waking_up': return shadow() + bed(321, 229, 1.15) + float(cat(283, 184, .88, phase), phase) + clock(455, 113, .51, .7) + bubble(188, 116, '?', .8)
    case 'talking_phone': return shadow(302, 95) + float(phone(302, 199, 1.22), phase) + bubble(443, 129, 'Привет!', 1.1) + line('M206 166Q190 190 206 212M191 154Q167 190 191 224', '#8dedf0', 4)
    case 'candy_rain': return cloud(230, 102, 1.1) + cloud(414, 92, .9) + Array.from({ length: 9 }, (_, i) => { const x = 164 + i * 39; const y = 161 + ((i * 37 + phase / (Math.PI * 2) * 118) % 118); return group(x, y, .75, `<g transform="rotate(${i * 31})">${p('M-18-9-36-23V23L-18 9M18-9 36-23V23L18 9', i % 2 ? '#b0f7e6' : '#ffcd9a')}${r(-19, -15, 38, 30, i % 2 ? 'url(#pink)' : 'url(#purple)', 12)}${line('M0-13V13', '#fff0c0', 5)}</g>`) }).join('') + person(324, 202, .63, 'url(#cobalt)', 'up')
    case 'invisible_person': return shadow(315, 85) + person(316, 149, 1.07, 'url(#purple)', 'normal', .26 + (bob + 1) * .12) + line('M251 161V129Q250 83 294 76M380 161V129Q380 83 343 76', '#b6e8fb', 3, 'stroke-dasharray="6 9"') + star(240, 213, .9) + star(408, 127, .8) + bubble(432, 208, '?')
    case 'talking_cat': return shadow(290, 103) + cat(290, 191 + bob * 3, 1.1, phase) + bubble(430, 126, 'Привет!', 1.05) + r(145, 266, 76, 15, 'url(#mint)', 8)
    case 'on_the_moon': return c(481, 90, 37, 'url(#cobalt)') + p('M460 61 477 71 471 89 495 93 501 110 475 119 460 101Z', '#8ee9d4') + e(319, 332, 287, 110, '#b4aad8') + e(201, 267, 48, 13, '#8577ba') + e(400, 308, 58, 16, '#8577ba') + person(322, 147 + bob * 4, 1, 'url(#white)', 'up') + c(322, 149 + bob * 4, 37, 'none', 'stroke="#bdf1ff" stroke-width="4"') + line('M408 174V274', '#e8ddff', 5) + p('M411 175H464L446 194 464 211H411Z', 'url(#pink)')
    case 'flying_house': return cloud(163, 241, .9) + cloud(458, 216, 1.1) + float(house(317, 181, .83), phase, 2) + line('M274 288 265 307M318 291V315M363 286 372 306', '#baafff', 4) + star(164, 115, .8)
    case 'president': return r(241, 81, 158, 199, '#8878c7', 70) + line('M186 139V282M455 139V282', '#d5c6ff', 5) + p('M188 140H237V200H188ZM408 140H457V200H408Z', 'url(#pink)') + person(319, 132 + bob * 3, .86, 'url(#cobalt)') + r(231, 222, 176, 73, 'url(#purple)', 12) + star(319, 255, 1.2) + line('M350 225 352 198 337 188', '#e0d8ff', 5)
    case 'growing_wings': return shadow() + wing(295, 209 + bob * 3, 1.05) + wing(345, 209 + bob * 3, 1.05, true) + person(321, 145 + bob * 3, .98, 'url(#purple)', 'up') + star(178, 150, .7) + star(451, 139, 1)
    case 'frozen_time': return clock(317, 177, 1.46, -Math.PI / 2) + r(300, 149, 12, 49, 'url(#pink)', 3) + r(323, 149, 12, 49, 'url(#pink)', 3) + e(168, 224 + bob, 13, 21, '#b3f8ff') + e(459, 125 + bob, 13, 21, '#b3f8ff') + star(438, 269, .7)
    case 'animal_language': return shadow() + cat(195, 221, .63, phase) + person(322, 147, .99, 'url(#purple)') + dog(449, 218, .69, phase) + bubble(210, 126, '…', .7) + bubble(432, 115, '…', .7) + line('M263 163Q319 123 376 160', '#b6f1eb', 4, 'stroke-dasharray="7 9"')
    case 'living_food': return shadow() + e(319, 281, 165, 27, 'url(#white)') + group(273, 198 + bob * 4, 1, p('M-54 33-5-72 61 36Z', 'url(#gold)') + line('M-51 35H60', '#db9868', 10) + c(-4, -27, 9, '#f17ca6') + c(22, 15, 10, '#f17ca6') + smile(-1, 9) + line('M-40 35-54 67M40 35 53 62', '#a595ec', 5)) + group(391, 213 - bob * 4, 1, c(0, 0, 40, 'url(#pink)') + line('M0-39 5-54', '#93e6b7', 6) + smile(0, -5) + line('M-18 36-32 64M18 36 31 59', '#a595ec', 5))
    case 'mind_reading': return shadow() + person(240, 153, .98, 'url(#mint)') + person(403, 153, .98, 'url(#purple)') + bubble(412, 77, '♥', 1) + line('M289 158Q322 108 359 155', '#c4aaff', 4, 'stroke-dasharray="5 8"') + eye(318, 157 + bob * 3, .33)
    case 'giant_person': return shadow(325, 185) + house(184, 252, .41) + house(458, 251, .37) + person(324, 108 + bob * 2, 1.53, 'url(#purple)') + tree(118, 251, .31)
    case 'million_win': return shadow() + coins(phase) + text(320, 112, '1 000 000', 40, '#ffe6a0') + star(168, 171, 1.2) + star(471, 169, .9)
    case 'promotion': return shadow() + briefcase(317, 230, 1.16) + float(trophy(397, 146, .73), phase) + p('M183 219V166H162L203 119 244 166H223V219Z', 'url(#mint)') + coin(463, 253, .76) + star(297, 105, .7)
    case 'meeting_old_friend': return shadow() + person(246, 145 + bob * 2, 1.07, 'url(#mint)', 'up') + person(394, 145 - bob * 2, 1.07, 'url(#pink)', 'up') + bubble(321, 89, '!', .7) + star(156, 189, .6) + star(477, 218, .8)
    case 'dream_come_true': return shadow() + person(317, 161, .95, 'url(#purple)', 'up') + float(star(319, 100, 2.3), phase) + star(207, 150, 1) + star(430, 141, 1.15) + p('M197 260Q319 105 441 260', 'none', 'stroke="#b392fa" stroke-width="12" opacity=".3"')
    case 'finding_treasure': return shadow() + r(214, 194, 210, 94, 'url(#gold)', 12) + p('M214 194V146Q318 97 424 146V194Z', '#dd9a5e') + p('M225 183V150Q320 122 412 150V183Z', '#4c357d') + line('M243 201V284M395 201V284', '#ffe5a8', 14) + coin(274, 182, .86) + coin(320, 174 + bob * 3, 1) + coin(367, 180, .91) + r(304, 218, 30, 29, '#fff0b8', 5) + star(441, 124, .9)
    case 'wedding_invitation': return shadow() + group(318, 205 + bob * 3, 1.3, r(-87, -43, 174, 118, 'url(#pink)', 10) + p('M-87-38 0-97 87-38 0 25Z', '#c9b8ff') + r(-68, -70, 136, 107, 'url(#white)', 8) + p('M0-13Q-43-42-28-56-9-72 0-48 10-72 28-56 43-41 0-13', '#f58bb6') + p('M-87-38 0 27 87-38V75H-87Z', 'url(#pink)') + line('M-87 75-29 15M87 75 29 15', '#ffc1dd', 2)) + star(173, 131, .8) + star(465, 249, 1)
    case 'exam_success': return shadow() + float(document(287, 189, 1.3, '5'), phase) + trophy(421, 228, .73) + star(182, 119, .9) + star(449, 120, .7)
    case 'friend_from_abroad': return shadow() + globe(204, 177, .7) + person(371, 145, 1.08, 'url(#mint)', 'up') + r(428, 241, 53, 56, 'url(#pink)', 8) + line('M440 239V215H466V239', '#d6c2ff', 5) + plane(214, 154 + bob * 3, .4, -22)
    case 'lottery_win': return shadow() + group(302, 185 + bob * 3, 1.12, p('M-115-56H115V-25Q84-12 115 3V57H-115V3Q-84-12-115-25Z', 'url(#pink)') + line('M-68-48V47', '#ffe7be', 3, 'stroke-dasharray="5 5"') + text(20, 13, '7 7 7', 40, '#fff4c0') + star(-93, -6, .7)) + coin(224, 284, .8) + coin(412, 271, .9) + star(462, 106, 1)
    case 'puppy_gift': return shadow() + gift(314, 230, 1.15) + dog(315, 155 + bob * 3, .93, phase) + r(230, 230, 169, 37, 'url(#pink)', 7) + r(303, 228, 23, 77, 'url(#gold)', 4) + star(447, 161, .9)
    case 'missed_plane': return shadow() + plane(410, 112 + bob * 4, .65, -13) + person(242 + bob * 4, 170, .96, 'url(#purple)', 'run') + r(324, 243, 55, 52, 'url(#pink)', 8) + line('M337 242V224H361V242', '#e2d4ff', 4) + clock(155, 121, .5, 1.1) + line('M441 169 414 177M475 167 456 174', '#bcbeff', 3)
    case 'house_fire': return shadow() + house(318, 188, .96, '#ffb485') + flame(252, 232 + bob * 3, .63) + flame(372, 205 - bob * 4, .85) + flame(316, 135 + bob * 3, .53) + cloud(315, 84, .55) + bubble(457, 127, '!', .75)
    case 'lost_wallet': return shadow(302, 125) + group(291, 219 + bob * 3, 1.2, r(-77, -41, 154, 94, 'url(#purple)', 13) + r(-65, -56, 122, 32, '#ccb2fa', 5) + r(19, -16, 65, 40, 'url(#pink)', 8) + c(38, 4, 6, '#ffe1a7')) + question(440, 139, 1.2) + line('M180 146 193 133M170 171H190M198 114 206 126', '#c9bcff', 4) + coin(417, 274, .53)
    case 'attacking_dog': return shadow() + dog(310 + bob * 6, 172, 1.2, phase, true) + bubble(454, 132, '!', .8) + line('M188 201H220M179 221H217M197 243H221', '#b9c1ff', 5)
    case 'lost_in_forest': return tree(155, 190, 1.04) + tree(470, 200, 1.15) + tree(224, 139, .58) + tree(393, 158, .63) + shadow(321, 89) + person(319, 181, .84, 'url(#pink)') + question(321, 113 + bob * 3, .8) + p('M278 308Q375 267 337 234', 'none', 'stroke="#c6a4e5" stroke-width="15" opacity=".5"')
    case 'stolen_phone': return shadow() + phone(280, 198, 1.1, false) + p('M282 178 304 155 326 178H315V220H293V178Z', 'url(#pink)') + group(417 + bob * 4, 190, 1, c(0, 0, 42, '#4c3d83') + r(-37, -16, 74, 23, '#241c4f', 12) + c(-14, -4, 4, '#c6bcff') + c(14, -4, 4, '#c6bcff') + line('M-10 22H10', '#e7d3ff', 3)) + bubble(179, 116, '!', .7)
    case 'falling_in_hole': return e(321, 282, 153, 36, '#b292da') + e(321, 275, 134, 28, '#26164e') + person(318, 192 + bob * 8, .82, 'url(#pink)', 'up') + p('M171 289Q318 324 473 289V330H171Z', '#8061b8') + line('M267 111V143M324 99V133M376 111V141', '#cabaff', 4) + bubble(458, 177, '!', .75)
    case 'earthquake': return shadow(320, 191) + group(bob * 4, 0, 1, house(317, 190, 1)) + p('M175 302 270 284 295 307 331 278 356 301 452 288', 'none', 'stroke="#e1c1f7" stroke-width="7"') + line('M151 170 138 184 151 198M487 170 500 184 487 198', '#c9c3ff', 5)
    case 'forgotten_password': return shadow() + phone(287, 201, 1.22, false) + r(265, 190, 45, 43, 'url(#pink)', 8) + line('M274 190V180Q286 159 301 180V190', '#ffc5dd', 6) + text(286, 253, '• • • •', 19, '#e2eeff') + question(435, 132 + bob * 4, 1.3)
    case 'overslept_work': return shadow() + bed(289, 235, 1.1) + person(254, 175, .57, 'url(#purple)') + clock(434, 147, .92, phase) + line('M380 96 367 83M485 96 497 83', '#ffe3a3', 5) + text(210, 118 + bob * 3, 'Z z', 26, '#c9c2ff')
    case 'sneeze_cat': return shadow() + cat(326, 184 + bob * 2, 1.12, phase) + bubble(180, 124, 'Апчхи!', .94) + star(427, 205, 1) + star(237, 250, .6) + star(449, 141, .7)
    case 'clown_boss': return shadow() + person(314, 148 + bob * 2, 1.11, 'url(#pink)') + c(314, 155 + bob * 2, 12, '#ff668f') + c(280, 128 + bob * 2, 17, '#b69afe') + c(349, 128 + bob * 2, 17, '#b69afe') + p('M286 112 314 51 341 112Z', 'url(#gold)') + c(315, 49, 10, '#ff87bc') + p('M286 181 314 195 342 181V207L314 196 286 207Z', '#96f3db') + briefcase(450, 256, .55)
    case 'running_soup': return shadow() + group(315 + bob * 8, 211, 1.2, line('M-29 46-61 74-35 87M24 46 52 69 73 60', '#b4c2ff', 9) + p('M-77-12Q-66 55 0 58 66 55 77-12Z', 'url(#mint)') + e(0, -12, 78, 21, '#e5faf0') + e(0, -12, 66, 14, '#ffbd76') + c(-24, -15, 6, '#ff849a') + c(25, -8, 7, '#89cca4') + smile(0, 12) + line('M-36-50Q-48-63-32-77M2-49Q-10-65 5-80M38-49Q26-64 42-78', '#d2cdfc', 4)) + line('M162 214H193M156 233H194', '#bfc4ff', 5)
    case 'missing_shadow': return person(254, 151, 1.1, 'url(#mint)') + e(410, 293, 76, 14, 'none', 'stroke="#bca5ef" stroke-width="3" stroke-dasharray="8 8"') + question(412, 215 + bob * 3, 1.12) + line('M303 272 329 282 307 290', '#bca5ef', 3)
    case 'speaking_meow': return shadow() + person(282, 151, 1.14, 'url(#purple)') + bubble(438, 133 + bob * 3, 'Мяу!', 1.15) + cat(430, 245, .45, phase)
    case 'bed_boat': return p('M81 248Q116 224 158 246T236 247T314 247T392 247T470 247T553 247V360H81Z', '#56b8db', 'opacity=".48"') + group(0, bob * 4, 1, bed(320, 212, 1.02) + p('M183 254H458L419 294H224Z', 'url(#gold)')) + line('M163 311Q197 296 234 311M397 321Q431 307 468 321', '#b3f4fa', 4) + person(284, 158, .65, 'url(#pink)')
    case 'sleeping_office': return desk(319, 226, 1.7) + person(221, 174, .67, 'url(#mint)') + person(418, 174, .67, 'url(#purple)') + laptop(319, 208, .65) + text(227, 132 + bob * 4, 'Z z', 30, '#d0bbff') + text(424, 119 - bob * 4, 'Z z', 26, '#d0bbff') + clock(321, 98, .43, .8)
    case 'singing_kettle': return shadow() + group(304, 214 + bob * 3, 1.15, line('M51-29Q112-46 97 12L61 32', '#a0a5ec', 14) + p('M-56-26-92-57-107-48-66 15Z', 'url(#mint)') + e(0, 9, 69, 62, 'url(#mint)') + r(-36, -54, 72, 20, '#a9f3db', 8) + c(0, -61, 9, '#d1b1f3') + smile(-4, -1)) + text(446, 143 + bob * 6, '♪', 56, '#ffcf86') + text(183, 148 - bob * 6, '♫', 43, '#d0b4ff')
    case 'talking_puddle': return shadow(318, 167) + group(0, bob * 1.5, 1, e(318, 254, 155, 45, 'url(#cobalt)') + e(318, 247, 128, 30, '#99eaf1', 'opacity=".25"') + smile(318, 245)) + bubble(422, 145, 'Эй!', 1) + group(216, 173, 1, p('M-22-52H24L30 23 69 35Q82 44 68 53H-21Z', 'url(#pink)')) + line('M225 247 214 222M190 255 175 241M253 238 263 222', '#b9f1ff', 4)
    case 'running_socks': return shadow() + group(246 + bob * 7, 198, 1.1, p('M-32-68H15V18L60 44Q75 66 53 79 35 90 17 75L-32 40Z', 'url(#pink)') + r(-35, -72, 53, 23, '#ffe5ba', 5) + line('M15 76-2 96-25 94', '#c4c1ff', 6)) + group(378 - bob * 7, 177, 1.05, p('M-32-68H15V18L60 44Q75 66 53 79 35 90 17 75L-32 40Z', 'url(#mint)') + r(-35, -72, 53, 23, '#e5d1ff', 5) + line('M15 76 40 99 59 93', '#c4c1ff', 6)) + line('M147 197H179M139 219H175', '#c2bbff', 4)
    case 'time_machine': return shadow() + r(222, 92, 194, 208, 'url(#purple)', 28) + r(236, 107, 166, 172, '#393675', 18) + clock(318, 184, 1.06, phase * .5) + c(268, 284, 7, '#9cf6dd') + c(294, 284, 7, '#ffb592') + line('M259 85V60M380 85V60', '#bca8ff', 5) + star(176, 190 + bob * 4, 1) + star(464, 141, .8)
    case 'one_wish': return shadow() + group(296, 232 + bob * 3, 1.1, e(0, 0, 67, 37, 'url(#gold)') + p('M-49-10-94-32-88-4-54 13M48-10Q99-57 102-15L70 13', 'url(#gold)') + r(-36, 29, 72, 10, '#e6a75a', 5) + r(-24, -43, 48, 17, '#ffe3a2', 6)) + p('M297 177Q273 138 327 139T341 97', 'none', 'stroke="#bca5ff" stroke-width="22" opacity=".6"') + float(star(341, 89, 1.5), phase) + text(433, 142, '1', 39, '#ffe4a4')
    case 'one_day_invisible': return shadow() + person(296, 150, 1.08, 'url(#mint)', 'up', .22 + (bob + 1) * .13) + r(409, 165, 77, 85, 'url(#white)', 10) + r(409, 165, 77, 21, 'url(#pink)', 8) + text(447, 230, '1', 35, '#7663bf') + star(182, 148, .8) + star(383, 100, .65)
    case 'all_languages': return shadow() + globe(319, 194 + bob * 3, 1.2) + bubble(173, 116, 'Hi!', .84) + bubble(467, 121, '你好', .8) + bubble(166, 250, '¡Hola!', .79) + bubble(480, 252, 'Salom', .8)
    case 'flying_person': return cloud(165, 237, .93) + cloud(477, 225, .88) + group(321, 176 + bob * 7, 1, `<g transform="rotate(-19)">${person(0, 0, .98, 'url(#purple)', 'up')}</g>`) + line('M294 291 282 312M324 293 318 316M350 287 351 305', '#c7bcff', 4) + star(439, 103, .8)
    case 'mind_reading_2': return shadow() + person(240, 160, .99, 'url(#pink)') + person(410, 160, .99, 'url(#mint)') + bubble(412, 82, '★', 1) + line('M286 147Q324 108 364 146', '#ffcba4', 4, 'stroke-dasharray="5 8"') + eye(321, 149 + bob * 3, .35)
    case 'becoming_invisible': return shadow() + person(244, 151, 1.07, 'url(#purple)') + person(409, 151, 1.07, 'url(#purple)', 'normal', .18 + (bob + 1) * .1) + line('M302 199H351M337 186 353 199 337 212', '#d6c2ff', 5) + star(468, 141, .8) + star(373, 246, .7)
    case 'magic_wand': return shadow(320, 126) + float(wand(316, 170, 1.3, 31 + bob * 3), phase) + star(442, 150, 1.3, '#ffb8d7') + star(205, 122, 1.1) + star(214, 246, .7, '#b5fce9') + star(439, 263, .8) + p('M204 215Q316 102 436 217', 'none', 'stroke="#b491ef" stroke-width="4" stroke-dasharray="5 10"')
    case 'change_past': return shadow() + clock(325, 198, 1.3, -1.3) + p('M378 111Q299 55 234 120L252 138 195 144 201 87 217 103Q300 26 398 91Z', 'url(#mint)') + float(star(449, 238, .8), phase)
    case 'see_future': return shadow() + group(319, 190 + bob * 3, 1.2, c(0, 0, 77, 'url(#lilac)') + c(-25, -32, 29, '#ddceff', 'opacity=".55"') + eye(0, 4, .62) + p('M-51 59H51L67 88H-67Z', 'url(#gold)') + r(-69, 85, 138, 13, '#f2c88b', 5)) + star(190, 157, 1) + star(461, 101, .8)
    case 'job_interview': return desk(324, 223, 1.5) + person(212, 156, .76, 'url(#purple)') + person(428, 154, .76, 'url(#mint)') + document(320, 204, .41) + bubble(412, 91 + bob * 2, '?', .74) + briefcase(143, 265, .4)
    case 'project_win': return shadow() + laptop(277, 242, 1.35) + document(278, 209, .41) + float(trophy(426, 174, .98), phase) + star(191, 116, .9)
    case 'conference_speech': return person(322, 125, .82, 'url(#purple)') + r(245, 212, 154, 88, 'url(#cobalt)', 11) + line('M350 213 352 182 337 173', '#ded5ff', 5) + bubble(429, 118 + bob * 3, '…', .85) + [166, 218, 425, 477].map((x, i) => c(x, 287 + i % 2 * 9, 19, '#a49ae8') + r(x - 24, 302 + i % 2 * 9, 48, 39, '#6e60ad', 18)).join('')
    case 'book_published': return shadow() + book(264, 195, 1.24) + book(366, 221, .94, 'url(#pink)') + float(star(433, 119, 1.2), phase) + line('M172 195 157 181M180 168 170 150', '#c7c4ff', 4)
    case 'grant_received': return shadow() + document(277, 188 + bob * 3, 1.24) + coin(365, 262, .88) + coin(411, 252, 1.1) + group(442, 153, .65, line('M-18-48V-8L-47 40Q-51 53-38 58H38Q51 53 47 40L18-8V-48', '#bdd7ff', 6) + r(-26, -60, 52, 12, '#8ebaf8', 4) + p('M-30 17H30L45 43Q48 51 35 53H-35Q-48 51-45 43Z', 'url(#mint)') + c(1, 28, 6, '#c7fff0'))
    default: throw new Error(`Missing illustration: ${name}`)
  }
}

function svg(name, frame) {
  const phase = frame / frames * Math.PI * 2
  const id = scenes.indexOf(name)
  const body = sceneBody(name, phase)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img"><defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="${id % 3 === 0 ? '#6550b2' : id % 3 === 1 ? '#4c4da8' : '#5a469c'}"/><stop offset="1" stop-color="#292756"/></linearGradient>
    <linearGradient id="purple" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c6a7ff"/><stop offset=".45" stop-color="#9b79ed"/><stop offset="1" stop-color="#6950b7"/></linearGradient>
    <linearGradient id="cobalt" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9cdbff"/><stop offset=".5" stop-color="#7ba9ee"/><stop offset="1" stop-color="#5c70c4"/></linearGradient>
    <linearGradient id="pink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffc6e4"/><stop offset=".5" stop-color="#f38fbe"/><stop offset="1" stop-color="#c9699f"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1b0"/><stop offset=".5" stop-color="#f6ca7e"/><stop offset="1" stop-color="#dc9c59"/></linearGradient>
    <linearGradient id="mint" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c4ffeb"/><stop offset=".5" stop-color="#89dfce"/><stop offset="1" stop-color="#58a9b4"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffe6c9"/><stop offset="1" stop-color="#eeb39f"/></linearGradient>
    <linearGradient id="white" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaff"/><stop offset="1" stop-color="#c1d7f4"/></linearGradient>
    <linearGradient id="lilac" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9ceff"/><stop offset=".5" stop-color="#b3a6e8"/><stop offset="1" stop-color="#8a83c6"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="#a6a2ff" stop-opacity=".25"/><stop offset="1" stop-color="#a6a2ff" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#1b1547" flood-opacity=".22"/></filter>
  </defs>${r(0, 0, 640, 360, 'url(#bg)', 0)}${e(321, 173, 275, 192, 'url(#glow)')}${e(320, 336, 307, 61, '#9385cb', 'opacity=".12"')}${c(113, 89, 3, '#c0b3ed', 'opacity=".4"')}${c(524, 267, 4, '#bab3ed', 'opacity=".4"')}${star(530, 82, .37, '#c8b9f2')}${star(95, 253, .32, '#c8b9f2')}<g filter="url(#shadow)">${body}</g></svg>`
}

await fs.mkdir(output, { recursive: true })
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'first-reaction-media-'))
const requested = process.argv.slice(2)
const selected = requested.length ? scenes.filter((scene) => requested.includes(scene)) : scenes
if (!selected.length) throw new Error('No matching scenes')
try {
  for (const name of selected) {
    const directory = path.join(temporary, name)
    await fs.mkdir(directory)
    await fs.writeFile(path.join(output, `${name}.svg`), svg(name, 0))
    await Promise.all(Array.from({ length: frames }, async (_, frame) => {
      await sharp(Buffer.from(svg(name, frame))).png().toFile(path.join(directory, `${String(frame).padStart(2, '0')}.png`))
    }))
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(directory, '%02d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle', '-loop', '0', path.join(output, `${name}.gif`)], { windowsHide: true })
    const stat = await fs.stat(path.join(output, `${name}.gif`))
    console.log(`${name}: ${Math.round(stat.size / 1024)} KiB`)
  }
  const manifest = { width: 640, height: 360, frames, durationMs: frames / fps * 1000, scenes: scenes.map((scene) => ({ scene: `${scene}.gif`, poster: `${scene}.svg` })) }
  await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
} finally {
  await fs.rm(temporary, { recursive: true, force: true })
}
