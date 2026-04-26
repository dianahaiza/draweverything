clc; clear; close all;

%% Load Image
I_org = imread('SKKUG.png');
I_org = double(I_org); % Convert to double for calculations

%% PROBLEM 1: Quantization of Image
fprintf('PROBLEM 1: Quantization of Image');

%% 1(a): Calculate entropy of original image
entropy_org = entropy(uint8(I_org));
fprintf('\n1(a): Original Image Entropy = %.4f\n', entropy_org);

%% 1(b): Quantization with different step sizes
quantSteps = [22, 27, 32, 37, 42];
entropy_quant_list = zeros(1, length(quantSteps));
psnr_quant_list = zeros(1, length(quantSteps));

fprintf('\n1(b): Quantization Results\n');
fprintf('Step Size\tEntropy\t\tPSNR(dB)\n');
fprintf('----------------------------------------\n');

for i = 1:length(quantSteps)
    step = quantSteps(i);
    
    % Quantization and Dequantization
    I_quant = round(I_org / step) * step;
    I_quant = uint8(max(0, min(255, I_quant))); % Clipping to [0, 255]
    
    % Compute Entropy
    entropy_quant_list(i) = entropy(I_quant);
    
    % Compute PSNR
    mse = mean((I_org(:) - double(I_quant(:))).^2);
    psnr_quant_list(i) = 10*log10(255^2 / mse);
    
    % Save the image
    filename = sprintf('SKKUG_quant_%d.png', step);
    imwrite(I_quant, filename);
    
    fprintf('%d\t\t%.4f\t\t%.4f\n', step, entropy_quant_list(i), psnr_quant_list(i));
end

% Plot PSNR vs Entropy for Problem 1
figure('Name', 'Problem 1: PSNR vs Entropy - Quantization');
plot(entropy_quant_list, psnr_quant_list, '-o', 'LineWidth', 2, 'MarkerSize', 8);
xlabel('Entropy');
ylabel('PSNR (dB)');
title('PSNR vs Entropy - Quantization');
grid on;
for i = 1:length(quantSteps)
    text(entropy_quant_list(i), psnr_quant_list(i), sprintf('  %d', quantSteps(i)));
end

%% PROBLEM 2: Quantization after Transform
fprintf('\nPROBLEM 2: Quantization after Transform');

%% 2(a): Apply DCT2 and calculate entropy
I_dct = dct2(I_org);
entropy_dct = entropy(uint8(max(0, min(255, I_dct + 128)))); % Shift and clip for entropy calculation
fprintf('\n2(a): DCT Transformed Image Entropy = %.4f\n', entropy_dct);

%% 2(b): Inverse DCT and calculate entropy
I_idct = idct2(I_dct);
I_idct = uint8(max(0, min(255, I_idct))); % Clipping
entropy_idct = entropy(I_idct);
fprintf('\n2(b): Inverse DCT Image Entropy = %.4f\n', entropy_idct);

%% 2(c): Compare three entropy values
fprintf('\n2(c): Entropy Comparison\n');
fprintf('Original Image Entropy (1a): %.4f\n', entropy_org);
fprintf('DCT Coefficients Entropy (2a): %.4f\n', entropy_dct);
fprintf('Inverse DCT Image Entropy (2b): %.4f\n', entropy_idct);

%% 2(d): Quantization in DCT domain
entropy_tr_quant_list = zeros(1, length(quantSteps));
psnr_tr_quant_list = zeros(1, length(quantSteps));

fprintf('\n2(d): Transform + Quantization Results\n');
fprintf('Step Size\tEntropy\t\tPSNR(dB)\n');
fprintf('----------------------------------------\n');

for i = 1:length(quantSteps)
    step = quantSteps(i);
    
    % Quantization in DCT domain
    I_dct_quant = round(I_dct / step) * step;
    
    % Compute entropy of quantized DCT coefficients
    entropy_tr_quant_list(i) = entropy(uint8(max(0, min(255, I_dct_quant + 128))));
    
    % Inverse DCT
    I_tr_recon = idct2(I_dct_quant);
    I_tr_recon = uint8(max(0, min(255, I_tr_recon))); % Clipping
    
    % Compute PSNR
    mse = mean((I_org(:) - double(I_tr_recon(:))).^2);
    psnr_tr_quant_list(i) = 10*log10(255^2 / mse);
    
    % Save the image
    filename = sprintf('SKKUG_tr_quant_%d.png', step);
    imwrite(I_tr_recon, filename);
    
    fprintf('%d\t\t%.4f\t\t%.4f\n', step, entropy_tr_quant_list(i), psnr_tr_quant_list(i));
end

% Plot PSNR vs Entropy for Problem 2
figure('Name', 'Problem 2: PSNR vs Entropy (Transform + Quantization)');
plot(entropy_tr_quant_list, psnr_tr_quant_list, '-s', 'LineWidth', 2, 'MarkerSize', 8);
xlabel('Entropy');
ylabel('PSNR (dB)');
title('PSNR vs Entropy - Transform + Quantization');
grid on;
for i = 1:length(quantSteps)
    text(entropy_tr_quant_list(i), psnr_tr_quant_list(i), sprintf('  %d', quantSteps(i)));
end