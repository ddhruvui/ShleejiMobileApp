import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  radii,
  shadows,
  TAB_BAR_HEIGHT,
  TAB_BAR_SIDE_GAP,
  tabBarBottomOffset,
} from "../theme";

/**
 * Floating tab bar. Only the active tab shows its name, inside a soft brand
 * pill — five full labels don't fit a phone ("Affirmations" truncated) and the
 * icons are distinct enough on their own. Every tab still carries its full
 * name as the accessible label.
 *
 * Presses go through navigation.emit("tabPress") so App.js's screenListeners
 * (re-tapping an active tab returns to Todo) keep working.
 */
export const TAB_ICONS = {
  Dream: ["sparkles", "sparkles-outline"],
  Affirmations: ["heart", "heart-outline"],
  Todo: ["checkbox", "checkbox-outline"],
  Calls: ["call", "call-outline"],
  Counter: ["radio-button-on", "radio-button-off"],
};

export default function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: tabBarBottomOffset(insets.bottom) }]}
    >
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const [activeIcon, idleIcon] = TAB_ICONS[route.name] || ["ellipse", "ellipse-outline"];

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              style={styles.item}
            >
              <View style={[styles.pill, focused && styles.pillActive]}>
                <Ionicons
                  name={focused ? activeIcon : idleIcon}
                  size={22}
                  color={focused ? colors.primary : colors.textTertiary}
                />
                {focused ? (
                  <Text style={styles.label} numberOfLines={1}>
                    {label}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: TAB_BAR_SIDE_GAP,
    right: TAB_BAR_SIDE_GAP,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.xl + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.floating,
  },
  item: {
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 48,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
});
