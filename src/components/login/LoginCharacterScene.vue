<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LoginEyeBall from '@/components/login/LoginEyeBall.vue'
import LoginPupil from '@/components/login/LoginPupil.vue'

const props = defineProps({
  isTyping: {
    type: Boolean,
    default: false,
  },
  passwordLength: {
    type: Number,
    default: 0,
  },
  showPassword: {
    type: Boolean,
    default: false,
  },
})

const SCENE_ENTRANCE_END_MS = 2080
const SCENE_ENTRANCE_HOLD_MS = 200
const SCENE_ENTRANCE_TOTAL_MS = SCENE_ENTRANCE_END_MS + SCENE_ENTRANCE_HOLD_MS

const blackRef = ref(null)
const orangeRef = ref(null)
const purpleRef = ref(null)
const yellowRef = ref(null)

const isBlackBlinking = ref(false)
const isBlackBrowLifting = ref(false)
const isLookingAtEachOther = ref(false)
const isOrangeSnickering = ref(false)
const isPurpleBlinking = ref(false)
const isPurplePeeking = ref(false)
const isPurpleShrugging = ref(false)
const isSceneReady = ref(false)
const isYellowLateSmiling = ref(false)
const mouseX = ref(0)
const mouseY = ref(0)

const timers = []
let blackBrowLiftToken = 0
let orangeSnickerToken = 0
let peekCycleToken = 0
let yellowSmileToken = 0

function getRandomPeekInterval() {
  return Math.random() * 3000 + 2000
}

function getRandomSnickerInterval() {
  return Math.random() * 2600 + 1600
}

function getRandomBlackBrowLiftInterval() {
  return Math.random() * 2200 + 2400
}

function registerTimer(callback, delay) {
  const timerId = window.setTimeout(() => {
    const index = timers.indexOf(timerId)
    if (index >= 0) {
      timers.splice(index, 1)
    }
    callback()
  }, delay)

  timers.push(timerId)
  return timerId
}

function clearAllTimers() {
  while (timers.length) {
    window.clearTimeout(timers.pop())
  }
}

function updateMousePosition(event) {
  mouseX.value = event.clientX
  mouseY.value = event.clientY
}

function scheduleBlink(stateRef) {
  registerTimer(() => {
    stateRef.value = true
    registerTimer(() => {
      stateRef.value = false
      scheduleBlink(stateRef)
    }, 150)
  }, Math.random() * 4000 + 3000)
}

function canPeekPasswordNow() {
  return props.passwordLength > 0 && props.showPassword
}

function canOrangeSnickerNow() {
  return !props.showPassword && (props.isTyping || props.passwordLength > 0)
}

function canBlackBrowLiftNow() {
  return props.passwordLength > 0 && !props.showPassword
}

function canYellowLateSmileNow() {
  return props.passwordLength > 0 && props.showPassword
}

function schedulePurplePeekLoop(token, delay) {
  registerTimer(() => {
    if (token !== peekCycleToken || !canPeekPasswordNow()) {
      return
    }

    isPurplePeeking.value = true

    registerTimer(() => {
      if (token !== peekCycleToken || !canPeekPasswordNow()) {
        return
      }

      isPurplePeeking.value = false

      isPurpleShrugging.value = true

      registerTimer(() => {
        if (token !== peekCycleToken) {
          return
        }

        isPurpleShrugging.value = false

        if (!canPeekPasswordNow()) {
          return
        }

        schedulePurplePeekLoop(token, getRandomPeekInterval())
      }, 520)
    }, 800)
  }, delay)
}

function scheduleOrangeSnickerLoop(token, delay) {
  registerTimer(() => {
    if (token !== orangeSnickerToken || !canOrangeSnickerNow()) {
      return
    }

    isOrangeSnickering.value = true

    registerTimer(() => {
      if (token !== orangeSnickerToken) {
        return
      }

      isOrangeSnickering.value = false

      if (!canOrangeSnickerNow()) {
        return
      }

      scheduleOrangeSnickerLoop(token, getRandomSnickerInterval())
    }, 460)
  }, delay)
}

function scheduleBlackBrowLiftLoop(token, delay) {
  registerTimer(() => {
    if (token !== blackBrowLiftToken || !canBlackBrowLiftNow()) {
      return
    }

    isBlackBrowLifting.value = true

    registerTimer(() => {
      if (token !== blackBrowLiftToken) {
        return
      }

      isBlackBrowLifting.value = false

      if (!canBlackBrowLiftNow()) {
        return
      }

      scheduleBlackBrowLiftLoop(token, getRandomBlackBrowLiftInterval())
    }, 920)
  }, delay)
}

function calculatePosition(element) {
  if (!isSceneReady.value || !element) {
    return {
      bodySkew: 0,
      faceX: 0,
      faceY: 0,
    }
  }

  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 3
  const deltaX = mouseX.value - centerX
  const deltaY = mouseY.value - centerY

  return {
    faceX: Math.max(-15, Math.min(15, deltaX / 20)),
    faceY: Math.max(-10, Math.min(10, deltaY / 30)),
    bodySkew: Math.max(-6, Math.min(6, -deltaX / 120)),
  }
}

const blackPose = computed(() => calculatePosition(blackRef.value))
const orangePose = computed(() => calculatePosition(orangeRef.value))
const purplePose = computed(() => calculatePosition(purpleRef.value))
const yellowPose = computed(() => calculatePosition(yellowRef.value))

const canBlackBrowLift = computed(() => isSceneReady.value && canBlackBrowLiftNow())
const canPeekPassword = computed(() => isSceneReady.value && canPeekPasswordNow())
const canOrangeSnicker = computed(() => isSceneReady.value && canOrangeSnickerNow())
const canYellowLateSmile = computed(() => isSceneReady.value && canYellowLateSmileNow())
const isHidingPassword = computed(() => props.passwordLength > 0 && !props.showPassword)
const orangeExpression = computed(() => {
  if (!isSceneReady.value) {
    return 'soft'
  }

  if (props.passwordLength > 0 && props.showPassword) {
    return 'surprised'
  }

  if (isOrangeSnickering.value) {
    return 'grin'
  }

  if (props.isTyping) {
    return 'grin'
  }

  if (props.passwordLength > 0) {
    return 'smile'
  }

  return 'soft'
})
const blackExpression = computed(() => {
  if (!isSceneReady.value) {
    return 'flat'
  }

  if (isHidingPassword.value) {
    return 'skeptical'
  }

  if (props.passwordLength > 0 && props.showPassword) {
    return 'caught'
  }

  if (isLookingAtEachOther.value) {
    return 'smirk'
  }

  return 'flat'
})
const purpleExpression = computed(() => {
  if (!isSceneReady.value) {
    return 'soft'
  }

  if (props.passwordLength > 0 && props.showPassword) {
    if (isPurpleShrugging.value) {
      return 'smug'
    }

    return isPurplePeeking.value ? 'gasp' : 'sly'
  }

  if (props.isTyping) {
    return 'smile'
  }

  if (props.passwordLength > 0) {
    return 'grim'
  }

  return 'soft'
})
const yellowExpression = computed(() => {
  if (!isSceneReady.value) {
    return 'flat'
  }

  return isYellowLateSmiling.value ? 'late-smile' : 'flat'
})

onMounted(() => {
  mouseX.value = window.innerWidth / 2
  mouseY.value = window.innerHeight / 2
  window.addEventListener('mousemove', updateMousePosition, { passive: true })
  registerTimer(() => {
    isSceneReady.value = true
    scheduleBlink(isPurpleBlinking)
    scheduleBlink(isBlackBlinking)
  }, SCENE_ENTRANCE_TOTAL_MS)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', updateMousePosition)
  clearAllTimers()
})

watch(() => props.isTyping, (value) => {
  if (!isSceneReady.value || !value) {
    isLookingAtEachOther.value = false
    return
  }

  isLookingAtEachOther.value = true
  registerTimer(() => {
    isLookingAtEachOther.value = false
  }, 800)
})

watch(
  canBlackBrowLift,
  (enabled) => {
    blackBrowLiftToken += 1
    isBlackBrowLifting.value = false

    if (!enabled) {
      return
    }

    scheduleBlackBrowLiftLoop(blackBrowLiftToken, getRandomBlackBrowLiftInterval())
  },
  { immediate: true },
)

watch(
  canOrangeSnicker,
  (enabled) => {
    orangeSnickerToken += 1
    isOrangeSnickering.value = false

    if (!enabled) {
      return
    }

    scheduleOrangeSnickerLoop(orangeSnickerToken, getRandomSnickerInterval())
  },
  { immediate: true },
)

watch(
  canYellowLateSmile,
  (enabled) => {
    yellowSmileToken += 1
    isYellowLateSmiling.value = false

    if (!enabled) {
      return
    }

    const token = yellowSmileToken
    registerTimer(() => {
      if (token !== yellowSmileToken || !canYellowLateSmileNow()) {
        return
      }

      isYellowLateSmiling.value = true
    }, 340)
  },
  { immediate: true },
)

watch(
  canPeekPassword,
  (enabled) => {
    peekCycleToken += 1
    isPurplePeeking.value = false
    isPurpleShrugging.value = false

    if (!enabled) {
      return
    }

    schedulePurplePeekLoop(peekCycleToken, getRandomPeekInterval())
  },
  { immediate: true },
)
</script>

<template>
  <div class="scene-wrapper">
    <div class="scene-canvas">
      <div class="scene-actor scene-actor--purple">
        <div
          ref="purpleRef"
          class="scene-character scene-character--purple"
          :style="{
            height: isTyping || isHidingPassword ? '440px' : '400px',
            transform: passwordLength > 0 && showPassword
              ? 'skewX(0deg)'
              : isTyping || isHidingPassword
                ? `skewX(${purplePose.bodySkew - 12}deg) translateX(40px)`
                : `skewX(${purplePose.bodySkew}deg)`,
          }"
        >
          <div
            class="scene-face scene-face--purple"
            :class="{ 'scene-face--purple-shrug': isPurpleShrugging }"
          >
            <div
              class="scene-mouth scene-mouth--purple"
              :class="`scene-mouth--purple-${purpleExpression}`"
              :style="{
                left: passwordLength > 0 && showPassword ? '34px' : `${66 + purplePose.faceX}px`,
                top: passwordLength > 0 && showPassword ? '88px' : `${96 + purplePose.faceY}px`,
              }"
            />
            <div
              class="scene-eyes scene-eyes--purple"
              :style="{
                left: passwordLength > 0 && showPassword ? '20px' : isLookingAtEachOther ? '55px' : `${45 + purplePose.faceX}px`,
                top: passwordLength > 0 && showPassword ? '35px' : isLookingAtEachOther ? '65px' : `${40 + purplePose.faceY}px`,
              }"
            >
              <LoginEyeBall
                :force-look-x="passwordLength > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined"
                :force-look-y="passwordLength > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined"
                :is-blinking="isPurpleBlinking"
                :max-distance="5"
                :mouse-x="mouseX"
                :mouse-y="mouseY"
                :pupil-size="7"
                :size="18"
              />
              <LoginEyeBall
                :force-look-x="passwordLength > 0 && showPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined"
                :force-look-y="passwordLength > 0 && showPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined"
                :is-blinking="isPurpleBlinking"
                :max-distance="5"
                :mouse-x="mouseX"
                :mouse-y="mouseY"
                :pupil-size="7"
                :size="18"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="scene-actor scene-actor--black">
        <div
          ref="blackRef"
          class="scene-character scene-character--black"
          :style="{
            transform: passwordLength > 0 && showPassword
              ? 'skewX(0deg)'
              : isLookingAtEachOther
                ? `skewX(${blackPose.bodySkew * 1.5 + 10}deg) translateX(20px)`
                : isTyping || isHidingPassword
                  ? `skewX(${blackPose.bodySkew * 1.5}deg)`
                  : `skewX(${blackPose.bodySkew}deg)`,
          }"
        >
          <div
            class="scene-brows scene-brows--black"
            :class="[
              `scene-brows--black-${blackExpression}`,
              { 'scene-brows--black-lift': isBlackBrowLifting },
            ]"
            :style="{
              left: passwordLength > 0 && showPassword ? '8px' : isLookingAtEachOther ? '24px' : `${18 + blackPose.faceX}px`,
              top: passwordLength > 0 && showPassword ? '14px' : isLookingAtEachOther ? '4px' : `${16 + blackPose.faceY}px`,
            }"
          >
            <span class="scene-brow" />
            <span class="scene-brow" />
          </div>
          <div
            class="scene-eyes scene-eyes--black"
            :style="{
              left: passwordLength > 0 && showPassword ? '10px' : isLookingAtEachOther ? '32px' : `${26 + blackPose.faceX}px`,
              top: passwordLength > 0 && showPassword ? '28px' : isLookingAtEachOther ? '12px' : `${32 + blackPose.faceY}px`,
            }"
          >
            <LoginEyeBall
              :force-look-x="passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined"
              :force-look-y="passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined"
              :is-blinking="isBlackBlinking"
              :max-distance="4"
              :mouse-x="mouseX"
              :mouse-y="mouseY"
              :pupil-size="6"
              :size="16"
            />
            <LoginEyeBall
              :force-look-x="passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? 0 : undefined"
              :force-look-y="passwordLength > 0 && showPassword ? -4 : isLookingAtEachOther ? -4 : undefined"
              :is-blinking="isBlackBlinking"
              :max-distance="4"
              :mouse-x="mouseX"
              :mouse-y="mouseY"
              :pupil-size="6"
              :size="16"
            />
          </div>
          <div
            class="scene-mouth scene-mouth--black"
            :class="`scene-mouth--black-${blackExpression}`"
            :style="{
              left: passwordLength > 0 && showPassword ? '12px' : isLookingAtEachOther ? '28px' : `${30 + blackPose.faceX}px`,
              top: passwordLength > 0 && showPassword ? '76px' : isLookingAtEachOther ? '66px' : `${82 + blackPose.faceY}px`,
            }"
          />
        </div>
      </div>

      <div class="scene-actor scene-actor--orange">
        <div
          ref="orangeRef"
          class="scene-character scene-character--orange"
          :style="{
            transform: passwordLength > 0 && showPassword
              ? 'skewX(0deg)'
              : `skewX(${orangePose.bodySkew}deg)`,
          }"
        >
          <div
            class="scene-face scene-face--orange"
            :class="{ 'scene-face--orange-snicker': isOrangeSnickering }"
          >
            <div
              class="scene-mouth scene-mouth--orange"
              :class="`scene-mouth--orange-${orangeExpression}`"
              :style="{
                left: passwordLength > 0 && showPassword ? '66px' : `${98 + orangePose.faceX}px`,
                top: passwordLength > 0 && showPassword ? '120px' : `${126 + orangePose.faceY}px`,
              }"
            />
            <div
              class="scene-eyes scene-eyes--orange"
              :style="{
                left: passwordLength > 0 && showPassword ? '50px' : `${82 + orangePose.faceX}px`,
                top: passwordLength > 0 && showPassword ? '85px' : `${90 + orangePose.faceY}px`,
              }"
            >
              <LoginPupil
                :force-look-x="passwordLength > 0 && showPassword ? -5 : undefined"
                :force-look-y="passwordLength > 0 && showPassword ? -4 : undefined"
                :max-distance="5"
                :mouse-x="mouseX"
                :mouse-y="mouseY"
                :size="12"
              />
              <LoginPupil
                :force-look-x="passwordLength > 0 && showPassword ? -5 : undefined"
                :force-look-y="passwordLength > 0 && showPassword ? -4 : undefined"
                :max-distance="5"
                :mouse-x="mouseX"
                :mouse-y="mouseY"
                :size="12"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="scene-actor scene-actor--yellow">
        <div
          ref="yellowRef"
          class="scene-character scene-character--yellow"
          :style="{
            transform: passwordLength > 0 && showPassword
              ? 'skewX(0deg)'
              : `skewX(${yellowPose.bodySkew}deg)`,
          }"
        >
          <div
            class="scene-eyes scene-eyes--yellow"
            :style="{
              left: passwordLength > 0 && showPassword ? '20px' : `${52 + yellowPose.faceX}px`,
              top: passwordLength > 0 && showPassword ? '35px' : `${40 + yellowPose.faceY}px`,
            }"
          >
            <LoginPupil
              :force-look-x="passwordLength > 0 && showPassword ? -5 : undefined"
              :force-look-y="passwordLength > 0 && showPassword ? -4 : undefined"
              :max-distance="5"
              :mouse-x="mouseX"
              :mouse-y="mouseY"
              :size="12"
            />
            <LoginPupil
              :force-look-x="passwordLength > 0 && showPassword ? -5 : undefined"
              :force-look-y="passwordLength > 0 && showPassword ? -4 : undefined"
              :max-distance="5"
              :mouse-x="mouseX"
              :mouse-y="mouseY"
              :size="12"
            />
          </div>
          <div
            class="scene-mouth"
            :class="`scene-mouth--yellow-${yellowExpression}`"
            :style="{
              left: passwordLength > 0 && showPassword ? '10px' : `${40 + yellowPose.faceX}px`,
              top: passwordLength > 0 && showPassword ? '88px' : `${88 + yellowPose.faceY}px`,
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene-wrapper {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.scene-canvas {
  position: relative;
  width: 550px;
  height: 400px;
}

.scene-actor {
  position: absolute;
  bottom: 0;
  transform-origin: bottom center;
  opacity: 0;
  animation-duration: 920ms;
  animation-fill-mode: both;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.24, 1);
}

.scene-actor--purple {
  left: 70px;
  z-index: 1;
  animation-delay: 80ms;
  animation-duration: 1100ms;
  animation-name: scene-purple-entrance;
}

.scene-actor--black {
  left: 240px;
  z-index: 2;
  animation-delay: 860ms;
  animation-duration: 760ms;
  animation-name: scene-black-entrance;
}

.scene-actor--orange {
  left: 0;
  z-index: 3;
  animation-delay: 720ms;
  animation-duration: 900ms;
  animation-name: scene-orange-entrance;
}

.scene-actor--yellow {
  left: 310px;
  z-index: 4;
  animation-delay: 1380ms;
  animation-duration: 700ms;
  animation-name: scene-yellow-entrance;
}

.scene-character {
  position: relative;
  transform-origin: bottom center;
  transition:
    transform 700ms ease-in-out,
    height 700ms ease-in-out;
}

.scene-character--purple {
  width: 180px;
  background: linear-gradient(180deg, #60a5fa 0%, #3b82f6 42%, #1d4ed8 100%);
  border-radius: 10px 10px 0 0;
  box-shadow: 0 24px 48px rgba(37, 99, 235, 0.2);
}

.scene-character--black {
  width: 120px;
  height: 310px;
  background: #2d2d2d;
  border-radius: 8px 8px 0 0;
}

.scene-character--orange {
  width: 240px;
  height: 200px;
  background: #ff9b6b;
  border-radius: 120px 120px 0 0;
}

.scene-character--yellow {
  width: 140px;
  height: 230px;
  background: #e8d754;
  border-radius: 70px 70px 0 0;
}

.scene-eyes {
  position: absolute;
  display: flex;
  transition: all 700ms ease-in-out;
}

.scene-eyes--purple {
  gap: 32px;
}

.scene-eyes--black {
  gap: 24px;
}

.scene-eyes--orange {
  gap: 32px;
  transition-duration: 200ms;
  transition-timing-function: ease-out;
}

.scene-eyes--yellow {
  gap: 24px;
  transition-duration: 200ms;
  transition-timing-function: ease-out;
}

.scene-face {
  position: absolute;
  inset: 0;
}

.scene-face--purple {
  transform-origin: 38% 22%;
}

.scene-face--purple-shrug {
  animation: purple-smug-shrug 520ms cubic-bezier(0.2, 0.78, 0.24, 1);
}

.scene-face--orange {
  transform-origin: 56% 56%;
}

.scene-face--orange-snicker {
  animation: orange-snicker 460ms cubic-bezier(0.2, 0.8, 0.22, 1);
}

.scene-brows {
  position: absolute;
  display: flex;
  gap: 16px;
  transform-origin: center;
  transition: all 220ms ease-out;
}

.scene-brow {
  width: 18px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  transform-origin: center;
  transition:
    transform 220ms ease-out,
    opacity 220ms ease-out;
}

.scene-brows--black-flat .scene-brow {
  opacity: 0.42;
}

.scene-brows--black-smirk .scene-brow:first-child {
  transform: translateY(-2px) rotate(-8deg);
}

.scene-brows--black-smirk .scene-brow:last-child {
  transform: rotate(6deg);
}

.scene-brows--black-skeptical .scene-brow:first-child {
  transform: translateY(-5px) rotate(-16deg);
}

.scene-brows--black-skeptical .scene-brow:last-child {
  transform: translateY(2px) rotate(12deg);
}

.scene-brows--black-caught .scene-brow:first-child {
  transform: translateY(-1px) rotate(-4deg);
}

.scene-brows--black-caught .scene-brow:last-child {
  transform: translateY(-1px) rotate(4deg);
}

.scene-brows--black-lift {
  animation: black-brow-lift 920ms cubic-bezier(0.22, 0.84, 0.24, 1);
}

.scene-mouth {
  position: absolute;
  box-sizing: border-box;
  color: #2d2d2d;
  transition: all 220ms ease-out;
}

.scene-mouth--purple-soft,
.scene-mouth--purple-smile,
.scene-mouth--purple-sly,
.scene-mouth--purple-smug {
  width: 28px;
  height: 10px;
  border-bottom: 3px solid currentColor;
  border-radius: 0 0 16px 16px;
}

.scene-mouth--purple-soft {
  opacity: 0.72;
  transform: scaleX(0.86);
}

.scene-mouth--purple-smile {
  transform: translateY(1px) scaleX(1.04);
}

.scene-mouth--purple-sly {
  transform: translateX(6px) rotate(9deg);
}

.scene-mouth--purple-smug {
  transform: translateX(7px) translateY(-1px) rotate(-6deg) scaleX(1.1);
}

.scene-mouth--purple-grim {
  width: 18px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  transform: rotate(-8deg);
}

.scene-mouth--purple-gasp {
  width: 12px;
  height: 12px;
  border: 3px solid currentColor;
  border-radius: 999px;
  transform: translateX(6px) translateY(-2px);
}

.scene-mouth--black {
  color: rgba(255, 255, 255, 0.94);
}

.scene-mouth--black-flat {
  width: 22px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.74;
}

.scene-mouth--black-smirk {
  width: 24px;
  height: 10px;
  border-bottom: 3px solid currentColor;
  border-radius: 0 0 16px 16px;
  transform: translateX(6px) rotate(8deg);
}

.scene-mouth--black-skeptical {
  width: 22px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  transform: translateX(7px) rotate(10deg);
}

.scene-mouth--black-caught {
  width: 12px;
  height: 12px;
  border: 3px solid currentColor;
  border-radius: 999px;
  transform: translateY(-1px);
}

.scene-mouth--orange-soft,
.scene-mouth--orange-smile,
.scene-mouth--orange-grin {
  width: 34px;
  height: 14px;
  border-bottom: 4px solid currentColor;
  border-radius: 0 0 18px 18px;
}

.scene-mouth--orange-soft {
  opacity: 0.66;
  transform: scaleX(0.72);
}

.scene-mouth--orange-smile {
  transform: scaleX(0.92);
}

.scene-mouth--orange-grin {
  transform: translateY(2px) scaleX(1.08);
}

.scene-mouth--orange-surprised {
  width: 14px;
  height: 14px;
  border: 4px solid currentColor;
  border-radius: 999px;
  transform: translateX(10px) translateY(-1px);
}

.scene-mouth--yellow-flat {
  width: 80px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
}

.scene-mouth--yellow-late-smile {
  width: 60px;
  height: 11px;
  border-bottom: 4px solid currentColor;
  border-radius: 0 0 18px 18px;
  transform: translateX(10px) translateY(2px) rotate(1deg) scaleX(0.9);
}

@keyframes orange-snicker {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  18% {
    transform: translate3d(1px, -1px, 0) rotate(-0.8deg);
  }

  36% {
    transform: translate3d(-1px, 1px, 0) rotate(0.9deg);
  }

  54% {
    transform: translate3d(1px, 0, 0) rotate(-0.6deg);
  }

  72% {
    transform: translate3d(-1px, -1px, 0) rotate(0.5deg);
  }
}

@keyframes scene-purple-entrance {
  0% {
    opacity: 0;
    transform: translate3d(0, -380px, 0) rotate(-10deg) scale(0.84);
  }

  58% {
    opacity: 1;
    transform: translate3d(0, 18px, 0) rotate(4deg) scale(1.02);
  }

  76% {
    transform: translate3d(0, -8px, 0) rotate(-2deg) scale(0.99);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }
}

@keyframes scene-black-entrance {
  0% {
    opacity: 0;
    transform: translate3d(220px, -10px, 0) rotate(12deg) scale(0.96);
  }

  68% {
    opacity: 1;
    transform: translate3d(-16px, 0, 0) rotate(-6deg) scale(1);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }
}

@keyframes scene-orange-entrance {
  0% {
    opacity: 0;
    transform: translate3d(0, 220px, 0) scale(0.9, 1.08);
  }

  42% {
    opacity: 1;
    transform: translate3d(0, -36px, 0) scale(1.04, 0.96);
  }

  64% {
    transform: translate3d(0, 12px, 0) scale(0.98, 1.02);
  }

  82% {
    transform: translate3d(0, -10px, 0) scale(1.01, 0.99);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes scene-yellow-entrance {
  0% {
    opacity: 0;
    transform: translate3d(-220px, 0, 0) scale(0.92, 1.04);
  }

  56% {
    opacity: 1;
    transform: translate3d(18px, 0, 0) scale(1.02, 0.98);
  }

  78% {
    transform: translate3d(-8px, 0, 0) scale(0.99, 1.01);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes purple-smug-shrug {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg);
  }

  24% {
    transform: translate3d(0, -3px, 0) rotate(-0.8deg);
  }

  48% {
    transform: translate3d(1px, -4px, 0) rotate(0.9deg);
  }

  72% {
    transform: translate3d(0, -2px, 0) rotate(-0.4deg);
  }
}

@keyframes black-brow-lift {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  34% {
    transform: translate3d(0, -3px, 0);
  }

  58% {
    transform: translate3d(0, -4px, 0);
  }

  78% {
    transform: translate3d(0, -2px, 0);
  }
}

@media (max-width: 1360px) {
  .scene-canvas {
    transform: scale(0.9);
    transform-origin: bottom center;
  }
}

@media (max-width: 1180px) {
  .scene-canvas {
    transform: scale(0.82);
  }
}
</style>
