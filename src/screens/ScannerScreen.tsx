import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import type { BarcodeScanningResult } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";

import { lookupBarcode } from "../services/openFoodFacts";
import { analyzeFoodImage } from "../services/openai";
import type { OFFProduct } from "../services/openFoodFacts";
import type { OpenAiAnalysis } from "../services/openai";
import { theme } from "../config/theme";

interface ScannerScreenProps {
  onScanComplete: (result: ScanResult) => void;
  onClose: () => void;
}

export interface ScanResult {
  scanType: "barcode" | "photo";
  barcodeData?: string;
  barcodeProduct?: OFFProduct;
  photoAnalysis?: OpenAiAnalysis;
  photoUri?: string;
  combinedResult?: {
    productName: string;
    brand: string | null;
    calories: number | null;
    sugarGrams: number | null;
    carbsGrams: number | null;
    proteinGrams: number | null;
    fatGrams: number | null;
    fiberGrams: number | null;
    imageUrl: string | null;
    ingredients: string | null;
    nutritionalScore: string | null;
    isSugarFree: boolean;
  };
}

const SCREEN_WIDTH = Dimensions.get("window").width;

export function ScannerScreen({ onScanComplete, onClose }: ScannerScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<"barcode" | "photo">("barcode");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const cameraRef = useRef<CameraView | null>(null);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (isProcessing || result.data === lastScannedBarcode) return;

      setIsProcessing(true);
      setLastScannedBarcode(result.data);

      try {
        const product = await lookupBarcode(result.data);
        const combined = product
          ? {
              productName: product.product_name ?? "Unknown product",
              brand: product.brand,
              calories: product.calories,
              sugarGrams: product.sugar_grams,
              carbsGrams: product.carbs_grams,
              proteinGrams: product.protein_grams,
              fatGrams: product.fat_grams,
              fiberGrams: product.fiber_grams,
              imageUrl: product.image_url,
              ingredients: product.ingredients,
              nutritionalScore: product.nutritional_score,
              isSugarFree: product.is_sugar_free,
            }
          : undefined;

        onScanComplete({
          scanType: "barcode",
          barcodeData: result.data,
          barcodeProduct: product ?? undefined,
          combinedResult: combined,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        Alert.alert("Scan failed", message);
        setIsProcessing(false);
      }
    },
    [isProcessing, lastScannedBarcode, onScanComplete]
  );

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;

    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });

      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const analysis = await analyzeFoodImage(compressed.uri);

      onScanComplete({
        scanType: "photo",
        photoAnalysis: analysis,
        photoUri: compressed.uri,
        combinedResult: {
          productName: analysis.productName,
          brand: null,
          calories: analysis.estimatedCalories,
          sugarGrams: analysis.estimatedSugarGrams,
          carbsGrams: analysis.estimatedCarbsGrams,
          proteinGrams: analysis.estimatedProteinGrams,
          fatGrams: analysis.estimatedFatGrams,
          fiberGrams: null,
          imageUrl: compressed.uri,
          ingredients: null,
          nutritionalScore: null,
          isSugarFree: analysis.isSugarFree,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Analysis failed", message);
      setIsProcessing(false);
    }
  }, [onScanComplete]);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <LoadingSpinner fullScreen color={theme.colors.primary} label="Loading camera..." />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Camera permission is required</Text>
        <Text style={styles.subText}>
          GlucoScan needs camera access to scan food barcodes and take photos of
          meals.
        </Text>          <Pressable
            style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.8 }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={
          mode === "barcode"
            ? {
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "code128",
                  "code39",
                  "itf14",
                  "qr",
                ],
              }
            : undefined
        }
        onBarcodeScanned={mode === "barcode" ? handleBarcodeScanned : undefined}
      >
        {/* Overlay UI */}
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {mode === "barcode" ? "Scan Barcode" : "Take Photo"}
            </Text>
          </View>

          {/* Scan frame */}
          <View style={styles.scanFrame}>
            {mode === "barcode" && (
              <View style={styles.barcodeGuide}>
                <View style={[styles.barcodeLine, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.barcodeCornerTL]} />
                <View style={[styles.barcodeCornerTR]} />
                <View style={[styles.barcodeCornerBL]} />
                <View style={[styles.barcodeCornerBR]} />
              </View>
            )}
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            {/* Mode switcher */}
            <View style={styles.modeSwitcher}>
              <Pressable
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === "barcode" && styles.modeButtonActive,
                  pressed && !isProcessing && { opacity: 0.8 },
                ]}
                onPress={() => {
                  setMode("barcode");
                  setLastScannedBarcode(null);
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "barcode" && styles.modeButtonTextActive,
                  ]}
                >
                  📊 Barcode
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === "photo" && styles.modeButtonActive,
                  pressed && !isProcessing && { opacity: 0.8 },
                ]}
                onPress={() => setMode("photo")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === "photo" && styles.modeButtonTextActive,
                  ]}
                >
                  📸 Photo
                </Text>
              </Pressable>
            </View>

            {mode === "photo" && (
              <Pressable
                style={({ pressed }) => [styles.captureButton, isProcessing && styles.disabledButton, pressed && !isProcessing && { opacity: 0.8 }]}
                onPress={handleTakePhoto}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </CameraView>

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <LoadingSpinner
            fullScreen
            variant="transparent"
            color={theme.colors.primary}
            label={mode === "barcode" ? "Looking up product..." : "Analyzing with AI..."}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.base,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: theme.colors.textInverse,
    fontSize: 20,
    fontWeight: "bold",
  },
  headerTitle: {
    color: theme.colors.textInverse,
    fontSize: 18,
    fontWeight: "600",
    marginLeft: theme.spacing.base,
  },
  scanFrame: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  barcodeGuide: {
    width: SCREEN_WIDTH - 80,
    height: 120,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    justifyContent: "center",
    position: "relative",
  },
  barcodeCornerTL: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.colors.primary,
    borderTopLeftRadius: 12,
  },
  barcodeCornerTR: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.colors.primary,
    borderTopRightRadius: 12,
  },
  barcodeCornerBL: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: theme.colors.primary,
    borderBottomLeftRadius: 12,
  },
  barcodeCornerBR: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: theme.colors.primary,
    borderBottomRightRadius: 12,
  },
  barcodeLine: {
    height: 3,
    opacity: 0.8,
  },
  bottomControls: {
    paddingBottom: 60,
    alignItems: "center",
  },
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 24,
    padding: 4,
  },
  modeButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  modeButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "500",
  },
  modeButtonTextActive: {
    color: theme.colors.textInverse,
    fontWeight: "700",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: theme.colors.textInverse,
    marginTop: 24,
  },
  captureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: theme.colors.textInverse,
  },
  disabledButton: {
    opacity: 0.5,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  subText: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: theme.radius.md,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: theme.colors.textInverse,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.textInverse,
  },
  secondaryButtonText: {
    color: theme.colors.textInverse,
    fontSize: 16,
  },
});
